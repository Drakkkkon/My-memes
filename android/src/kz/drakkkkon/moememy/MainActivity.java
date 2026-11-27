package kz.drakkkkon.moememy;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.ContentValues;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.provider.Settings;
import android.util.Base64;
import android.view.View;
import android.view.WindowInsets;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.Toast;
import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import org.json.JSONObject;

/** Оболочка сайта Мое_мемы: новые версии сайта появляются в приложении сами. */
public class MainActivity extends Activity {
    private static final String HOME = "https://drakkkkon.github.io/My-memes/";
    private static final int PICK = 1, SAVE = 2, ASK = 3;
    private WebView web;
    private ValueCallback<Uri[]> picker;
    private byte[] saveData;
    private volatile Updater.Release update;
    private volatile String updateText = "";
    private long lastUpdateCheck;
    private boolean checking, waitingPermission;
    private int offered;
    private AlertDialog offer;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        web = new WebView(this);
        FrameLayout root = new FrameLayout(this);
        root.addView(web);
        // не залезаем под строку состояния, кнопки навигации и клавиатуру
        root.setOnApplyWindowInsetsListener((View v, WindowInsets in) -> {
            v.setPadding(in.getSystemWindowInsetLeft(), in.getSystemWindowInsetTop(),
                    in.getSystemWindowInsetRight(), in.getSystemWindowInsetBottom());
            return in.consumeSystemWindowInsets();
        });
        setContentView(root);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        web.setBackgroundColor(0xFF16161D);
        web.addJavascriptInterface(new Bridge(), "MMApp");

        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if (!request.isForMainFrame()) return false;
                String url = request.getUrl().toString();
                if (url.startsWith(HOME)) return false;
                // всё чужое открываем в браузере
                String scheme = request.getUrl().getScheme();
                if ("https".equals(scheme) || "http".equals(scheme) || "mailto".equals(scheme)) {
                    try {
                        startActivity(new Intent(Intent.ACTION_VIEW, request.getUrl()));
                    } catch (ActivityNotFoundException e) {
                        say("Нечем открыть ссылку");
                    }
                }
                return true;
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (!request.isForMainFrame()) return;
                view.loadDataWithBaseURL(null, "<meta charset=utf-8><meta name=viewport content='width=device-width'>"
                        + "<body style='background:#16161d;color:#f1f1f5;font:18px sans-serif;text-align:center;padding:40px'>Нет связи с сайтом."
                        + "<p><a style='color:#ffd23f' href='" + HOME + "'>Повторить</a></p>", "text/html", "utf-8", null);
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (picker != null) picker.onReceiveValue(null);
                picker = callback;
                Intent i = new Intent(Intent.ACTION_GET_CONTENT).addCategory(Intent.CATEGORY_OPENABLE).setType("image/*");
                try {
                    startActivityForResult(i, PICK);
                } catch (ActivityNotFoundException e) {
                    picker = null;
                    return false;
                }
                return true;
            }
        });

        if (state == null || web.restoreState(state) == null) web.loadUrl(HOME);
        Notify.schedule(getApplicationContext());
        // при первом запуске один раз спрашиваем про уведомления
        if (Build.VERSION.SDK_INT >= 33 && !getPreferences(MODE_PRIVATE).getBoolean("asked", false)
                && checkSelfPermission("android.permission.POST_NOTIFICATIONS") != PackageManager.PERMISSION_GRANTED) {
            getPreferences(MODE_PRIVATE).edit().putBoolean("asked", true).apply();
            requestPermissions(new String[]{"android.permission.POST_NOTIFICATIONS"}, ASK);
        }
    }

    private void say(String text) {
        Toast.makeText(this, text, Toast.LENGTH_LONG).show();
    }

    private static String safeName(String name) {
        String n = name.replaceAll("[^A-Za-z0-9_.-]", "_");
        return n.isEmpty() || n.startsWith(".") ? "meme.jpg" : n;
    }

    private static String safeMime(String mime) {
        return mime.matches("image/(jpeg|png|gif|webp)") ? mime : "image/jpeg";
    }

    /** Android 10+: сразу в галерею (Pictures/Мое_мемы). Старше: системное окно «Сохранить как». */
    private void saveImage(String name, byte[] data, String mime) {
        if (Build.VERSION.SDK_INT < 29) {
            saveData = data;
            try {
                startActivityForResult(new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE)
                        .setType(mime).putExtra(Intent.EXTRA_TITLE, name), SAVE);
            } catch (ActivityNotFoundException e) {
                say("Нечем сохранить файл");
            }
            return;
        }
        ContentValues v = new ContentValues();
        v.put(MediaStore.MediaColumns.DISPLAY_NAME, name);
        v.put(MediaStore.MediaColumns.MIME_TYPE, mime);
        v.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/Мое_мемы");
        Uri uri = null;
        try {
            uri = getContentResolver().insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, v);
            try (OutputStream out = getContentResolver().openOutputStream(uri)) {
                out.write(data);
            }
            say("Сохранено в галерею: Pictures/Мое_мемы");
        } catch (Exception e) {
            if (uri != null) getContentResolver().delete(uri, null, null);
            say("Не получилось сохранить картинку");
        }
    }

    private void shareImage(String name, byte[] data, String mime) {
        try {
            File dir = new File(getCacheDir(), "share");
            dir.mkdirs();
            File[] old = dir.listFiles();
            if (old != null) for (File f : old) if (System.currentTimeMillis() - f.lastModified() > 3600_000L) f.delete();
            try (OutputStream out = new FileOutputStream(new File(dir, name))) {
                out.write(data);
            }
            Uri uri = Uri.parse("content://" + getPackageName() + ".share/" + name);
            Intent i = new Intent(Intent.ACTION_SEND).setType(mime).putExtra(Intent.EXTRA_STREAM, uri)
                    .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            i.setClipData(ClipData.newRawUri("", uri));
            startActivity(Intent.createChooser(i, "Поделиться мемом"));
        } catch (Exception e) {
            say("Не получилось поделиться");
        }
    }

    private class Bridge {
        @JavascriptInterface
        public void saveImage(String name, String base64, String mime) {
            byte[] data = Base64.decode(base64, Base64.DEFAULT);
            runOnUiThread(() -> MainActivity.this.saveImage(safeName(name), data, safeMime(mime)));
        }

        @JavascriptInterface
        public void shareImage(String name, String base64, String mime) {
            byte[] data = Base64.decode(base64, Base64.DEFAULT);
            runOnUiThread(() -> MainActivity.this.shareImage(safeName(name), data, safeMime(mime)));
        }

        @JavascriptInterface
        public void notifyConfig(String json) {
            Notify.configure(getApplicationContext(), json);
        }

        @JavascriptInterface
        public String notifyStatus() {
            return Notify.status(getApplicationContext());
        }

        @JavascriptInterface
        public void notifyAllow() {
            runOnUiThread(() -> {
                if (Build.VERSION.SDK_INT >= 33
                        && checkSelfPermission("android.permission.POST_NOTIFICATIONS") != PackageManager.PERMISSION_GRANTED) {
                    requestPermissions(new String[]{"android.permission.POST_NOTIFICATIONS"}, ASK);
                } else if (!Notify.allowed(MainActivity.this)) {
                    notifySettings();
                } else {
                    allowResult();
                }
            });
        }

        @JavascriptInterface
        public void notifyCheck() {
            new Thread(() -> {
                Notify.check(getApplicationContext(), true);
                runOnUiThread(() -> web.evaluateJavascript("window.mmChecked&&mmChecked()", null));
            }).start();
        }

        @JavascriptInterface
        public void notifySettings() {
            runOnUiThread(() -> startActivity(new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
                    .putExtra(Settings.EXTRA_APP_PACKAGE, getPackageName())));
        }

        @JavascriptInterface
        public String updateStatus() {
            try {
                Updater.Release r = update;
                return new JSONObject().put("installed", Updater.installedName(MainActivity.this))
                        .put("available", r == null ? "" : r.version).put("text", updateText).toString();
            } catch (Exception e) {
                return "{}";
            }
        }

        @JavascriptInterface
        public void updateCheck() {
            runOnUiThread(() -> checkUpdate(true));
        }

        @JavascriptInterface
        public void updateInstall() {
            runOnUiThread(MainActivity.this::installUpdate);
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        boolean fromNotice = getIntent().getBooleanExtra("update", false);
        if (fromNotice) getIntent().removeExtra("update");
        if (waitingPermission) {
            // вернулись из настроек, где разрешают установку
            waitingPermission = false;
            if (getPackageManager().canRequestPackageInstalls()) installUpdate();
        } else if (fromNotice || System.currentTimeMillis() - lastUpdateCheck > 3 * 3600_000L) {
            checkUpdate(fromNotice);
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
    }

    private void checkUpdate(boolean asked) {
        if (checking) return;
        checking = true;
        lastUpdateCheck = System.currentTimeMillis();
        new Thread(() -> {
            Updater.Release found = null;
            String text;
            try {
                found = Updater.fetch(getApplicationContext());
                text = found == null ? "Установлена последняя версия." : "Версия " + found.version + " скачана.";
            } catch (Exception e) {
                text = "Не получилось проверить обновление. Проверьте интернет и попробуйте ещё раз.";
                lastUpdateCheck = 0;
            }
            final Updater.Release result = found;
            final String message = text;
            runOnUiThread(() -> {
                checking = false;
                if (isDestroyed()) return;
                update = result;
                updateText = message;
                web.evaluateJavascript("window.mmUpdate&&mmUpdate()", null);
                if (result != null && !isFinishing() && (asked || offered != result.code)) offerUpdate(result);
            });
        }).start();
    }

    private void offerUpdate(Updater.Release r) {
        if (offer != null && offer.isShowing()) return;
        offered = r.code;
        offer = new AlertDialog.Builder(this)
                .setTitle("Доступна версия " + r.version)
                .setMessage(r.notes)
                .setPositiveButton("Обновить", (d, w) -> installUpdate())
                .setNegativeButton("Позже", null)
                .show();
    }

    private void installUpdate() {
        Updater.Release r = update;
        if (r == null) {
            checkUpdate(true);
            return;
        }
        if (!getPackageManager().canRequestPackageInstalls()) {
            say("Разрешите установку для «Мое_мемы» и вернитесь назад");
            waitingPermission = true;
            try {
                startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + getPackageName())));
            } catch (ActivityNotFoundException e) {
                waitingPermission = false;
                say("Откройте настройки телефона и разрешите установку из этого приложения");
            }
            return;
        }
        new Thread(() -> {
            try {
                Updater.install(getApplicationContext(), r.file);
            } catch (Exception e) {
                // файл мог пропасть из кэша: при следующей попытке скачаем заново
                runOnUiThread(() -> {
                    update = null;
                    say("Не получилось начать установку. Нажмите «Проверить обновление».");
                });
            }
        }).start();
    }

    private void allowResult() {
        boolean ok = Notify.allowed(this);
        if (ok) Notify.test(this);
        web.evaluateJavascript("window.mmChecked&&mmChecked()", null);
    }

    @Override
    public void onRequestPermissionsResult(int request, String[] permissions, int[] results) {
        if (request == ASK && results.length > 0) allowResult();
    }

    @Override
    protected void onActivityResult(int request, int result, Intent data) {
        Uri uri = result == RESULT_OK && data != null ? data.getData() : null;
        if (request == PICK && picker != null) {
            picker.onReceiveValue(uri == null ? null : new Uri[]{uri});
            picker = null;
        }
        if (request == SAVE && uri != null && saveData != null) {
            try (OutputStream out = getContentResolver().openOutputStream(uri)) {
                out.write(saveData);
                say("Файл сохранён");
            } catch (Exception e) {
                say("Не получилось сохранить файл");
            }
            saveData = null;
        }
    }

    /** «Назад»: сначала закрывает окна и возвращает на «Мемы», потом сворачивает приложение. */
    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        web.evaluateJavascript("!!(window.mmBack&&mmBack())", handled -> {
            if (!"true".equals(handled)) moveTaskToBack(true);
        });
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }

    @Override
    protected void onDestroy() {
        web.destroy();
        super.onDestroy();
    }
}
