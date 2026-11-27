package kz.drakkkkon.moememy;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.job.JobInfo;
import android.app.job.JobScheduler;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.Date;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import org.json.JSONArray;
import org.json.JSONObject;

/** Настройки уведомлений, расписание и сама фоновая проверка. */
final class Notify {
    private static final String MEMES = "memes", UPDATES = "updates";
    private static final int JOB = 1, ID_MEMES = 1, ID_UPDATE = 2, ID_TEST = 3;

    private static SharedPreferences prefs(Context c) {
        return c.getSharedPreferences("notify", Context.MODE_PRIVATE);
    }

    static boolean allowed(Context c) {
        return c.getSystemService(NotificationManager.class).areNotificationsEnabled();
    }

    private static JSONObject config(Context c) {
        try {
            return new JSONObject(prefs(c).getString("config", "{}"));
        } catch (Exception e) {
            return new JSONObject();
        }
    }

    /** Страница присылает: {memes: вкл/выкл, hours: как часто, sources: [включённые базы]}. */
    static synchronized void configure(Context c, String json) {
        try {
            prefs(c).edit().putString("config", new JSONObject(json).toString()).apply();
        } catch (Exception ignored) {
            // испорченные настройки не должны ронять приложение
        }
        schedule(c);
    }

    /** Задание ходит раз в час и само решает, пора ли: так проверяется и новая версия приложения. */
    static void schedule(Context c) {
        JobScheduler jobs = c.getSystemService(JobScheduler.class);
        // повторное планирование сбивало бы отсчёт времени
        if (jobs.getPendingJob(JOB) != null) return;
        jobs.schedule(new JobInfo.Builder(JOB, new ComponentName(c, CheckJob.class))
                .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY)
                .setPeriodic(60 * 60 * 1000L)
                .setPersisted(true)
                .build());
    }

    static String status(Context c) {
        try {
            JSONObject config = config(c);
            return new JSONObject().put("allowed", allowed(c)).put("memes", config.optBoolean("memes", true))
                    .put("hours", config.optInt("hours", 6)).put("last", prefs(c).getString("last", "")).toString();
        } catch (Exception e) {
            return "{}";
        }
    }

    private static byte[] download(String address, int max) throws Exception {
        if (!address.startsWith("https://")) throw new Exception("не тот адрес");
        HttpURLConnection h = (HttpURLConnection) new URL(address).openConnection();
        h.setConnectTimeout(10000);
        h.setReadTimeout(15000);
        h.setRequestProperty("User-Agent", "Mozilla/5.0 (Android) MoeMemy");
        try {
            if (h.getResponseCode() != 200) throw new Exception("HTTP " + h.getResponseCode());
            try (InputStream in = h.getInputStream()) {
                ByteArrayOutputStream out = new ByteArrayOutputStream();
                byte[] buf = new byte[16384];
                for (int n; (n = in.read(buf)) > 0; ) {
                    out.write(buf, 0, n);
                    if (out.size() > max) throw new Exception("слишком большой файл");
                }
                return out.toByteArray();
            }
        } finally {
            h.disconnect();
        }
    }

    /**
     * asked = пользователь нажал «Проверить сейчас»: без ожидания срока и без тихих часов.
     * Вызывать не из главного потока.
     */
    static String check(Context c, boolean asked) {
        synchronized (CheckJob.class) { // две проверки сразу прислали бы одно и то же дважды
            SharedPreferences p = prefs(c);
            long now = System.currentTimeMillis();
            if (asked || now - p.getLong("updateAt", 0) >= 6 * 3600_000L) checkUpdate(c);
            JSONObject config = config(c);
            if (!config.optBoolean("memes", true)) return "Уведомления о мемах выключены";
            int hour = Calendar.getInstance().get(Calendar.HOUR_OF_DAY);
            if (!asked) {
                if (hour < 9 || hour >= 23) return "Тихие часы";
                // 10 минут запаса: система запускает задание неточно
                if (now - p.getLong("memesAt", 0) < config.optInt("hours", 6) * 3600_000L - 600_000L) return "Рано";
            }
            return checkMemes(c, config);
        }
    }

    private static void checkUpdate(Context c) {
        SharedPreferences p = prefs(c);
        try {
            String[] r = Updater.peek(c);
            p.edit().putLong("updateAt", System.currentTimeMillis()).apply();
            // об одной версии напоминаем один раз
            if (r == null || !allowed(c) || r[0].equals(p.getString("told", ""))) return;
            show(c, UPDATES, ID_UPDATE, "Мое_мемы: новая версия " + r[1], r[2] + " Нажмите, чтобы обновить.", null);
            p.edit().putString("told", r[0]).apply();
        } catch (Exception ignored) {
            // нет связи — проверим в другой раз
        }
    }

    private static String checkMemes(Context c, JSONObject config) {
        SharedPreferences p = prefs(c);
        JSONArray chosen = config.optJSONArray("sources");
        List<Memes.Item> fresh = new ArrayList<>();
        boolean first = false;
        int total = 0, failed = 0;
        try {
            Set<String> seen = new LinkedHashSet<>();
            JSONArray old = new JSONArray(p.getString("seen", "[]"));
            for (int i = 0; i < old.length(); i++) seen.add(old.getString(i));
            first = seen.isEmpty(); // самая первая проверка только запоминает, что уже есть
            for (String source : Memes.SOURCES) {
                if (chosen != null && !chosen.toString().contains("\"" + source + "\"")) continue;
                for (String url : Memes.urls(source)) {
                    total++;
                    try {
                        fresh.addAll(Memes.pick(seen, Memes.parse(source,
                                new String(download(url, 6_000_000), StandardCharsets.UTF_8))));
                    } catch (Exception e) {
                        failed++;
                    }
                }
            }
            p.edit().putString("seen", new JSONArray(seen).toString()).apply();
        } catch (Exception e) {
            return "Проверка не удалась";
        }
        if (total > failed) p.edit().putLong("memesAt", System.currentTimeMillis()).apply();
        if (!fresh.isEmpty() && !first && allowed(c)) {
            Memes.Item top = fresh.get(0);
            show(c, MEMES, ID_MEMES, "Свежие мемы: " + fresh.size(), top.title, picture(top.image));
        }
        String text = new SimpleDateFormat("d MMMM, HH:mm", new Locale("ru")).format(new Date())
                + ": баз " + total + ", не ответило " + failed + (first ? ", запомнил текущие мемы" : ", новых мемов " + fresh.size());
        p.edit().putString("last", text).apply();
        return text;
    }

    private static Bitmap picture(String url) {
        try {
            byte[] data = download(url, 3_000_000);
            BitmapFactory.Options o = new BitmapFactory.Options();
            o.inJustDecodeBounds = true;
            BitmapFactory.decodeByteArray(data, 0, data.length, o);
            o.inSampleSize = 1;
            while (Math.max(o.outWidth, o.outHeight) / o.inSampleSize > 1000) o.inSampleSize *= 2;
            o.inJustDecodeBounds = false;
            return BitmapFactory.decodeByteArray(data, 0, data.length, o);
        } catch (Exception e) {
            return null; // уведомление придёт без картинки
        }
    }

    static void test(Context c) {
        show(c, MEMES, ID_TEST, "Мое_мемы", "Уведомления включены ✅", null);
    }

    private static void show(Context c, String channel, int id, String title, String body, Bitmap image) {
        NotificationManager m = c.getSystemService(NotificationManager.class);
        m.createNotificationChannel(new NotificationChannel(channel,
                channel.equals(MEMES) ? "Свежие мемы" : "Обновления приложения", NotificationManager.IMPORTANCE_DEFAULT));
        Notification.Builder b = new Notification.Builder(c, channel)
                .setSmallIcon(R.drawable.ic_notify)
                .setColor(0xFFFFD23F)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(image == null ? new Notification.BigTextStyle().bigText(body)
                        : new Notification.BigPictureStyle().bigPicture(image).setSummaryText(body))
                .setContentIntent(PendingIntent.getActivity(c, id, new Intent(c, MainActivity.class).putExtra("update", id == ID_UPDATE),
                        PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE))
                .setAutoCancel(true);
        if (image != null) b.setLargeIcon(image);
        m.notify(id, b.build());
    }
}
