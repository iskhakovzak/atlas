package uz.atlasmarket.app;

import android.content.ClipData;
import android.content.ClipDescription;
import android.content.ClipboardManager;
import android.content.Context;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * The copied text, for the site's "Calculate the copied link" suggestion (app/clipboard-suggest.tsx). Android lets
 * the app in front read it; Android 12+ shows its own "Atlas pasted from your clipboard" note. Only text, at most
 * 2048 characters (SHARED_TEXT_LIMIT); nothing is kept or sent: the site checks it for a store link on the device.
 */
@CapacitorPlugin(name = "AtlasClipboard")
public class AtlasClipboardPlugin extends Plugin {
    private static final int LIMIT = 2048;

    @PluginMethod
    public void peek(PluginCall call) {
        JSObject result = new JSObject();
        ClipboardManager board = (ClipboardManager) getContext().getSystemService(Context.CLIPBOARD_SERVICE);
        if (board != null && board.hasPrimaryClip()) {
            ClipDescription description = board.getPrimaryClipDescription();
            boolean text = description != null && (description.hasMimeType(ClipDescription.MIMETYPE_TEXT_PLAIN)
                || description.hasMimeType(ClipDescription.MIMETYPE_TEXT_URILIST) || description.hasMimeType(ClipDescription.MIMETYPE_TEXT_HTML));
            ClipData clip = text ? board.getPrimaryClip() : null;
            if (clip != null && clip.getItemCount() > 0) {
                CharSequence value = clip.getItemAt(0).coerceToText(getContext());
                if (value != null) result.put("text", value.length() > LIMIT ? value.subSequence(0, LIMIT).toString() : value.toString());
            }
        }
        call.resolve(result);
    }

    /** The same text after a tap (iOS needs the tap; Android answers the same as peek). */
    @PluginMethod
    public void read(PluginCall call) {
        peek(call);
    }
}
