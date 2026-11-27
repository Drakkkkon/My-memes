package kz.drakkkkon.moememy;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import org.json.JSONArray;
import org.json.JSONObject;

/** Где искать свежие мемы и как разбирать ответы. */
final class Memes {
    static final class Item {
        final String id, title, image;
        Item(String id, String title, String image) {
            this.id = id;
            this.title = title;
            this.image = image;
        }
    }

    /** Базы, в которых появляется новое (Imgflip и Memegen — это неизменные шаблоны). */
    static final String[] SOURCES = {"memepedia", "redditru", "reddit", "lemmy"};

    static String[] urls(String source) {
        switch (source) {
            case "memepedia":
                return new String[]{"https://memepedia.world/wp-json/wp/v2/posts?per_page=10&_fields=id,title,content"};
            case "redditru":
                return new String[]{"https://meme-api.com/gimme/Pikabu/20"};
            case "reddit":
                return new String[]{"https://meme-api.com/gimme/memes/20"};
            case "lemmy":
                return new String[]{"https://lemmy.world/api/v3/post/list?community_name=memes&limit=20&sort=Hot"};
            default:
                return new String[0];
        }
    }

    static List<Item> parse(String source, String body) throws Exception {
        List<Item> out = new ArrayList<>();
        if (source.equals("memepedia")) {
            JSONArray posts = new JSONArray(body);
            for (int i = 0; i < posts.length(); i++) {
                JSONObject p = posts.getJSONObject(i);
                java.util.regex.Matcher m = java.util.regex.Pattern.compile("<img[^>]+?(?:data-src|src)=\"(https://[^\"]+)\"")
                        .matcher(p.getJSONObject("content").optString("rendered"));
                out.add(new Item("mp:" + p.getInt("id"), text(p.getJSONObject("title").optString("rendered")),
                        m.find() ? m.group(1) : ""));
            }
        } else if (source.equals("lemmy")) {
            JSONArray posts = new JSONObject(body).getJSONArray("posts");
            for (int i = 0; i < posts.length(); i++) {
                JSONObject p = posts.getJSONObject(i).getJSONObject("post");
                if (p.optBoolean("nsfw")) continue;
                out.add(new Item("lm:" + p.getInt("id"), p.optString("name"), p.optString("thumbnail_url")));
            }
        } else {
            JSONArray memes = new JSONObject(body).getJSONArray("memes");
            for (int i = 0; i < memes.length(); i++) {
                JSONObject p = memes.getJSONObject(i);
                if (p.optBoolean("nsfw") || p.optBoolean("spoiler")) continue;
                JSONArray preview = p.optJSONArray("preview");
                String image = preview != null && preview.length() > 0
                        ? preview.optString(Math.min(2, preview.length() - 1)) : p.optString("url");
                String link = p.optString("postLink", p.optString("url"));
                out.add(new Item("rd:" + link.substring(link.lastIndexOf('/') + 1), p.optString("title"), image));
            }
        }
        return out;
    }

    /** Оставляет только невиденные и запоминает их; список виденного не растёт бесконечно. */
    static List<Item> pick(Set<String> seen, List<Item> list) {
        List<Item> fresh = new ArrayList<>();
        for (Item i : list) if (seen.add(i.id)) fresh.add(i);
        java.util.Iterator<String> old = seen.iterator();
        while (seen.size() > 600 && old.hasNext()) {
            old.next();
            old.remove();
        }
        return fresh;
    }

    private static String text(String html) {
        java.util.regex.Matcher m = java.util.regex.Pattern.compile("&#(\\d{1,6});").matcher(html);
        StringBuffer s = new StringBuffer();
        while (m.find()) m.appendReplacement(s, java.util.regex.Matcher.quoteReplacement(
                new String(Character.toChars(Integer.parseInt(m.group(1))))));
        m.appendTail(s);
        return s.toString().replace("&quot;", "\"").replace("&laquo;", "«").replace("&raquo;", "»")
                .replace("&nbsp;", " ").replace("&amp;", "&");
    }
}
