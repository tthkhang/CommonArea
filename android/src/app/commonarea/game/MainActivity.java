package app.commonarea.game;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.pm.ActivityInfo;
import android.content.res.AssetManager;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.graphics.Typeface;
import android.net.Uri;
import android.os.Bundle;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

/**
 * Common Area for Android: one screen with a web view.
 *
 *  - Online: it opens the live game (ONLINE_URL), so multiplayer and friends work and the game is always the newest version.
 *  - Offline: when the live game cannot be reached (or the player chooses so), it opens the copy of the game packed inside
 *    this app (assets/www). That copy is served under a made-up https address (OFFLINE_HOST) because the game's
 *    scripts are ES modules, which a web view refuses to load from file://. With "?solo" the game does not look for
 *    a server and runs its rules in the web view, with computer villagers.
 *
 * The Back button opens a small menu (keep playing / online / offline / exit).
 */
public class MainActivity extends Activity {
    static final String ONLINE_HOST = "common-area.onrender.com";
    static final String ONLINE_URL = "https://" + ONLINE_HOST + "/";
    static final String OFFLINE_HOST = "common-area.offline";
    static final String OFFLINE_URL = "https://" + OFFLINE_HOST + "/index.html?solo";
    static final String ASSET_ROOT = "www";

    private static final Map<String, String> MIME = new HashMap<>();
    static {
        MIME.put("html", "text/html"); MIME.put("htm", "text/html"); MIME.put("css", "text/css");
        MIME.put("js", "text/javascript"); MIME.put("mjs", "text/javascript"); MIME.put("json", "application/json");
        MIME.put("txt", "text/plain"); MIME.put("md", "text/plain"); MIME.put("csv", "text/csv"); MIME.put("svg", "image/svg+xml");
        MIME.put("png", "image/png"); MIME.put("jpg", "image/jpeg"); MIME.put("jpeg", "image/jpeg"); MIME.put("gif", "image/gif");
        MIME.put("webp", "image/webp"); MIME.put("ico", "image/x-icon"); MIME.put("woff", "font/woff"); MIME.put("woff2", "font/woff2");
        MIME.put("ttf", "font/ttf"); MIME.put("mp3", "audio/mpeg"); MIME.put("ogg", "audio/ogg"); MIME.put("wav", "audio/wav");
        MIME.put("mp4", "video/mp4"); MIME.put("webm", "video/webm"); MIME.put("glb", "model/gltf-binary"); MIME.put("wasm", "application/wasm");
    }

    private FrameLayout root;
    private WebView web;
    private LinearLayout cover;      // shown while a page loads
    private TextView coverText;
    private Button offlineButton;
    private boolean online = true;   // which copy is (being) shown
    private boolean failed = false;  // the page being loaded could not be reached
    private View customView;         // a video playing full screen
    private WebChromeClient.CustomViewCallback customViewCallback;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON); // a study session should not dim the screen
        // The game's layout needs height: a phone held sideways is too short for it, so phones stay upright; tablets may turn.
        boolean phone = getResources().getConfiguration().smallestScreenWidthDp < 600;
        setRequestedOrientation(phone ? ActivityInfo.SCREEN_ORIENTATION_USER_PORTRAIT : ActivityInfo.SCREEN_ORIENTATION_FULL_USER);

        root = new FrameLayout(this);
        web = new WebView(this);
        root.addView(web, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        buildCover();
        setContentView(root);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);                      // the game saves the player's name, look and solo progress here
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);      // shared music and the cinema start by themselves
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setTextZoom(100);                                // keep the game's own text sizes, whatever the phone's font setting
        s.setUseWideViewPort(true);
        s.setLoadWithOverviewMode(true);
        s.setSupportMultipleWindows(false);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, true); // the YouTube player inside the game needs them
        web.setBackgroundColor(Color.parseColor("#F4EEFF"));
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        web.setWebViewClient(new GameClient());
        web.setWebChromeClient(new GameChrome());

        startOnline();
    }

    // ------------------------------------------------------------------ the loading cover
    private int dp(float v) { return Math.round(TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, getResources().getDisplayMetrics())); }

    private void buildCover() {
        cover = new LinearLayout(this);
        cover.setOrientation(LinearLayout.VERTICAL);
        cover.setGravity(Gravity.CENTER);
        cover.setBackgroundColor(Color.parseColor("#F4EEFF"));
        cover.setPadding(dp(28), dp(28), dp(28), dp(28));
        cover.setClickable(true); // swallow touches while it is up

        TextView title = new TextView(this);
        title.setText("Common Area");
        title.setTextColor(Color.parseColor("#7A4DFF"));
        title.setTextSize(TypedValue.COMPLEX_UNIT_SP, 30);
        title.setTypeface(Typeface.DEFAULT_BOLD);
        title.setGravity(Gravity.CENTER);
        cover.addView(title);

        ProgressBar bar = new ProgressBar(this);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(dp(44), dp(44));
        lp.setMargins(0, dp(22), 0, dp(18));
        cover.addView(bar, lp);

        coverText = new TextView(this);
        coverText.setTextColor(Color.parseColor("#2B1F4D"));
        coverText.setTextSize(TypedValue.COMPLEX_UNIT_SP, 15);
        coverText.setGravity(Gravity.CENTER);
        cover.addView(coverText);

        offlineButton = new Button(this);
        offlineButton.setText("Play offline instead");
        offlineButton.setAllCaps(false);
        offlineButton.setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) { startOffline(null); }
        });
        LinearLayout.LayoutParams bp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        bp.setMargins(0, dp(22), 0, 0);
        cover.addView(offlineButton, bp);

        root.addView(cover, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
    }

    private void showCover(String text, boolean withOfflineButton) {
        coverText.setText(text);
        offlineButton.setVisibility(withOfflineButton ? View.VISIBLE : View.GONE);
        cover.setVisibility(View.VISIBLE);
    }

    // ------------------------------------------------------------------ online / offline
    private void startOnline() {
        online = true; failed = false;
        showCover("Connecting to the online game…\nThe free game server sleeps when nobody plays,\nso waking it can take up to a minute.", true);
        web.stopLoading();
        web.loadUrl(ONLINE_URL);
    }

    private void startOffline(String why) {
        online = false; failed = false;
        showCover("Opening the offline game…", false);
        if (why != null) Toast.makeText(this, why, Toast.LENGTH_LONG).show();
        web.stopLoading();
        web.loadUrl(OFFLINE_URL);
    }

    private static boolean isGameHost(Uri u) {
        String h = u == null ? null : u.getHost();
        return ONLINE_HOST.equalsIgnoreCase(h) || OFFLINE_HOST.equalsIgnoreCase(h);
    }

    private class GameClient extends WebViewClient {
        /** The offline copy: answer every request for OFFLINE_HOST from the files packed in the app. */
        @Override
        public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
            Uri u = request.getUrl();
            if (u == null || !OFFLINE_HOST.equalsIgnoreCase(u.getHost())) return null;
            String path = u.getPath();
            if (path == null || path.isEmpty() || path.equals("/")) path = "/index.html";
            if (path.endsWith("/")) path = path + "index.html";
            if (path.contains("..")) return notFound();
            int dot = path.lastIndexOf('.');
            String ext = dot < 0 ? "" : path.substring(dot + 1).toLowerCase(Locale.ROOT);
            String mime = MIME.get(ext);
            if (mime == null) mime = "application/octet-stream";
            boolean text = mime.startsWith("text/") || mime.equals("application/json") || mime.equals("image/svg+xml");
            try {
                InputStream in = getAssets().open(ASSET_ROOT + path, AssetManager.ACCESS_STREAMING);
                WebResourceResponse r = new WebResourceResponse(mime, text ? "utf-8" : null, in);
                Map<String, String> headers = new HashMap<>();
                headers.put("Cache-Control", "no-cache");
                r.setResponseHeaders(headers);
                return r;
            } catch (IOException e) {
                return notFound();
            }
        }

        private WebResourceResponse notFound() {
            return new WebResourceResponse("text/plain", "utf-8", 404, "Not Found", new HashMap<String, String>(), new ByteArrayInputStream(new byte[0]));
        }

        /** The game stays in the app; any other page a player opens (a link in a reading, YouTube…) goes to the phone's browser. */
        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            if (!request.isForMainFrame()) return false;
            Uri u = request.getUrl();
            if (isGameHost(u)) return false;
            try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (Exception ignored) { }
            return true;
        }

        @Override
        public void onPageStarted(WebView view, String url, Bitmap favicon) {
            super.onPageStarted(view, url, favicon);
        }

        @Override
        public void onPageFinished(WebView view, String url) {
            super.onPageFinished(view, url);
            if (!failed && isGameHost(Uri.parse(url))) cover.setVisibility(View.GONE);
        }

        @Override
        public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
            if (!request.isForMainFrame()) return; // a font or a video that fails must not end the game
            mainPageFailed();
        }

        @Override
        public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse errorResponse) {
            if (request.isForMainFrame() && errorResponse != null && errorResponse.getStatusCode() >= 500) mainPageFailed();
        }

        private void mainPageFailed() {
            if (failed) return;
            failed = true;
            if (online) {
                web.post(new Runnable() {
                    @Override public void run() { startOffline("The online game cannot be reached. Playing offline (solo) instead."); }
                });
            } else {
                showCover("The offline game could not be opened.\nPlease install the app again.", false);
            }
        }
    }

    /** Lets a video inside the game go full screen and come back. */
    private class GameChrome extends WebChromeClient {
        @Override
        public void onShowCustomView(View view, CustomViewCallback callback) {
            if (customView != null) { callback.onCustomViewHidden(); return; }
            customView = view; customViewCallback = callback;
            root.addView(view, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
            view.setBackgroundColor(Color.BLACK);
            web.setVisibility(View.GONE);
        }

        @Override
        public void onHideCustomView() { hideCustomView(); }
    }

    private void hideCustomView() {
        if (customView == null) return;
        root.removeView(customView);
        customView = null;
        web.setVisibility(View.VISIBLE);
        if (customViewCallback != null) customViewCallback.onCustomViewHidden();
        customViewCallback = null;
    }

    // ------------------------------------------------------------------ Back button: a small menu
    @Override
    public void onBackPressed() {
        if (customView != null) { hideCustomView(); return; }
        final String[] items = {
            "Keep playing",
            online ? "Reload the online game" : "Go to the online game",
            online ? "Play offline (solo, saved on this phone)" : "Restart the offline game",
            "Exit" };
        new AlertDialog.Builder(this)
            .setTitle("Common Area" + (online ? "" : " (offline)"))
            .setItems(items, new android.content.DialogInterface.OnClickListener() {
                @Override public void onClick(android.content.DialogInterface d, int which) {
                    if (which == 1) startOnline();
                    else if (which == 2) startOffline(null);
                    else if (which == 3) finish();
                }
            })
            .show();
    }

    @Override protected void onPause() { super.onPause(); web.onPause(); }
    @Override protected void onResume() { super.onResume(); web.onResume(); }

    @Override
    protected void onDestroy() {
        root.removeView(web);
        web.destroy();
        super.onDestroy();
    }
}
