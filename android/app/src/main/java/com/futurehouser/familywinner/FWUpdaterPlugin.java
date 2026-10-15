package com.futurehouser.familywinner;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/** Descarga el APK de la última Release de GitHub y lanza el instalador de Android. */
@CapacitorPlugin(name = "FWUpdater")
public class FWUpdaterPlugin extends Plugin {

    @PluginMethod
    public void downloadAndInstall(PluginCall call) {
        String url = call.getString("url");
        if (url == null || !url.startsWith("https://")) {
            call.reject("URL no válida");
            return;
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                && !getContext().getPackageManager().canRequestPackageInstalls()) {
            Intent settings = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                    Uri.parse("package:" + getContext().getPackageName()));
            settings.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(settings);
            call.reject("Permite a FamilyWinner instalar aplicaciones y vuelve a pulsar «Actualizar».");
            return;
        }
        new Thread(() -> {
            try {
                File dir = new File(getContext().getCacheDir(), "updates");
                dir.mkdirs();
                File apk = new File(dir, "FamilyWinner.apk");
                download(url, apk);
                Uri uri = FileProvider.getUriForFile(getContext(),
                        getContext().getPackageName() + ".fileprovider", apk);
                Intent install = new Intent(Intent.ACTION_VIEW);
                install.setDataAndType(uri, "application/vnd.android.package-archive");
                install.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(install);
                call.resolve();
            } catch (Exception e) {
                call.reject("No se pudo descargar la actualización: " + e.getMessage());
            }
        }).start();
    }

    private void download(String address, File dest) throws Exception {
        HttpURLConnection conn = null;
        for (int i = 0; i < 10; i++) { // GitHub redirige a su CDN
            conn = (HttpURLConnection) new URL(address).openConnection();
            conn.setInstanceFollowRedirects(false);
            conn.setRequestProperty("User-Agent", "FamilyWinner-Updater");
            conn.setConnectTimeout(20000);
            conn.setReadTimeout(30000);
            int code = conn.getResponseCode();
            if (code >= 300 && code < 400) {
                address = conn.getHeaderField("Location");
                conn.disconnect();
                continue;
            }
            if (code != 200) throw new Exception("HTTP " + code);
            break;
        }
        long total = conn.getContentLengthLong();
        long got = 0;
        long lastEmit = 0;
        try (InputStream in = conn.getInputStream(); OutputStream out = new FileOutputStream(dest)) {
            byte[] buf = new byte[64 * 1024];
            int n;
            while ((n = in.read(buf)) > 0) {
                out.write(buf, 0, n);
                got += n;
                if (total > 0 && (got - lastEmit > 256 * 1024 || got == total)) {
                    lastEmit = got;
                    JSObject p = new JSObject();
                    p.put("progress", (double) got / total);
                    notifyListeners("progress", p);
                }
            }
        } finally {
            conn.disconnect();
        }
    }
}
