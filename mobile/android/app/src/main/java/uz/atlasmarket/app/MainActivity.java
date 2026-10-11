package uz.atlasmarket.app;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    /** Longer than any product link; matches SHARED_TEXT_LIMIT in lib/market/shared-link.ts. */
    private static final int SHARED_TEXT_LIMIT = 2048;

    // "Поделиться → Atlas" from a store app (the SEND filter in AndroidManifest.xml): the shared text becomes
    // https://atlasmarket.uz/share?text=…, which the site turns into the order-by-link page (app/share/route.ts).
    // As a VIEW intent it takes the app-link path: on a cold start the bridge keeps it as the launch URL, on a
    // warm one the App plugin fires appUrlOpen, and app/native-shell.tsx opens it in the WebView.
    @Override
    public void onCreate(Bundle savedInstanceState) {
        shareAsSiteLink(getIntent());
        super.onCreate(savedInstanceState);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        shareAsSiteLink(intent);
        super.onNewIntent(intent);
    }

    private static void shareAsSiteLink(Intent intent) {
        if (intent == null || !Intent.ACTION_SEND.equals(intent.getAction())) return;
        CharSequence text = intent.getCharSequenceExtra(Intent.EXTRA_TEXT);
        String subject = intent.getStringExtra(Intent.EXTRA_SUBJECT);
        Uri.Builder link = new Uri.Builder().scheme("https").authority("atlasmarket.uz").path("/share");
        if (text != null) link.appendQueryParameter("text", limit(text.toString()));
        if (subject != null) link.appendQueryParameter("title", limit(subject));
        intent.setAction(Intent.ACTION_VIEW);
        // setData also clears the text/plain type, so the bridge and the App plugin see an ordinary app link.
        intent.setData(link.build());
    }

    private static String limit(String value) {
        return value.length() > SHARED_TEXT_LIMIT ? value.substring(0, SHARED_TEXT_LIMIT) : value;
    }
}
