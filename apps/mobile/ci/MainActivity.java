package com.faxton.rentals;

import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.webkit.WebView;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  private static final String APP_HOST = "faxton-rentals.web.app";

  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    // Android 15 draws apps edge to edge. Pad the web view by the system bars so the page never sits under the clock and battery.
    WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
    getWindow().getDecorView().setBackgroundColor(Color.WHITE);
    WindowInsetsControllerCompat c = new WindowInsetsControllerCompat(getWindow(), getWindow().getDecorView());
    c.setAppearanceLightStatusBars(true);
    c.setAppearanceLightNavigationBars(true);
    View content = findViewById(android.R.id.content);
    ViewCompat.setOnApplyWindowInsetsListener(content, (v, insets) -> {
      Insets i = insets.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout() | WindowInsetsCompat.Type.ime());
      v.setPadding(i.left, i.top, i.right, i.bottom);
      return WindowInsetsCompat.CONSUMED;
    });
    openLink(getIntent());
  }

  @Override
  protected void onNewIntent(Intent intent) {
    super.onNewIntent(intent);
    setIntent(intent);
    openLink(intent);
  }

  // A tapped https://faxton-rentals.web.app/... link opens that page inside the app instead of the start page.
  private void openLink(Intent intent) {
    if (intent == null || !Intent.ACTION_VIEW.equals(intent.getAction())) return;
    Uri u = intent.getData();
    if (u == null || !"https".equals(u.getScheme()) || !APP_HOST.equals(u.getHost())) return;
    if (getBridge() == null) return;
    final WebView w = getBridge().getWebView();
    if (w != null) w.post(() -> w.loadUrl(u.toString()));
  }
}
