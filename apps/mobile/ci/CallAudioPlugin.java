package com.faxton.rentals;

import android.content.Context;
import android.media.AudioDeviceInfo;
import android.media.AudioManager;
import android.os.Build;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.List;

@CapacitorPlugin(name = "CallAudio")
public class CallAudioPlugin extends Plugin {
  private AudioManager audioManager;
  private int previousMode = AudioManager.MODE_NORMAL;
  private boolean previousSpeakerphone;
  private boolean sessionActive = false;

  private AudioManager audio() {
    if (audioManager == null) {
      audioManager = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
    }
    return audioManager;
  }

  @PluginMethod
  public void startCallAudio(PluginCall call) {
    try {
      AudioManager manager = audio();
      if (!sessionActive) {
        previousMode = manager.getMode();
        previousSpeakerphone = manager.isSpeakerphoneOn();
        sessionActive = true;
      }
      manager.setMode(AudioManager.MODE_IN_COMMUNICATION);
      routeTo(manager, false);
      call.resolve();
    } catch (Exception e) {
      restoreAudio();
      call.reject("Could not initialise call audio routing.", e);
    }
  }

  @PluginMethod
  public void setSpeakerphone(PluginCall call) {
    Boolean enabled = call.getBoolean("enabled");
    if (enabled == null) {
      call.reject("The enabled value is required.");
      return;
    }
    try {
      AudioManager manager = audio();
      if (!sessionActive) {
        previousMode = manager.getMode();
        previousSpeakerphone = manager.isSpeakerphoneOn();
        sessionActive = true;
        manager.setMode(AudioManager.MODE_IN_COMMUNICATION);
      }
      routeTo(manager, enabled);
      JSObject result = new JSObject();
      result.put("enabled", enabled);
      call.resolve(result);
    } catch (Exception e) {
      call.reject("Could not change the call audio output.", e);
    }
  }

  @PluginMethod
  public void stopCallAudio(PluginCall call) {
    restoreAudio();
    call.resolve();
  }

  private void routeTo(AudioManager manager, boolean speaker) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      List<AudioDeviceInfo> devices = manager.getAvailableCommunicationDevices();
      AudioDeviceInfo target = null;

      if (speaker) {
        target = findDevice(devices, AudioDeviceInfo.TYPE_BUILTIN_SPEAKER);
      } else {
        // Keep an already-connected Bluetooth headset in the call path; otherwise use the earpiece.
        target = findDevice(devices, AudioDeviceInfo.TYPE_BLUETOOTH_SCO);
        if (target == null) {
          target = findDevice(devices, AudioDeviceInfo.TYPE_BLE_HEADSET);
        }
        if (target == null) {
          target = findDevice(devices, AudioDeviceInfo.TYPE_BUILTIN_EARPIECE);
        }
      }

      if (target == null || !manager.setCommunicationDevice(target)) {
        throw new IllegalStateException("The requested audio output is unavailable.");
      }
      return;
    }

    // On older Android versions the system keeps an active Bluetooth SCO route;
    // otherwise setSpeakerphoneOn(false) selects the phone earpiece.
    manager.setSpeakerphoneOn(speaker);
  }

  private AudioDeviceInfo findDevice(List<AudioDeviceInfo> devices, int type) {
    for (AudioDeviceInfo device : devices) {
      if (device.getType() == type) return device;
    }
    return null;
  }

  private void restoreAudio() {
    if (!sessionActive || audioManager == null) return;
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        audioManager.clearCommunicationDevice();
      } else {
        audioManager.setSpeakerphoneOn(previousSpeakerphone);
      }
      audioManager.setMode(previousMode);
    } catch (Exception e) {
      android.util.Log.w("FaxtonCallAudio", "Could not fully restore audio routing.", e);
    } finally {
      sessionActive = false;
    }
  }
}
