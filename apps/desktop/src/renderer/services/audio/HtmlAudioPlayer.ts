/**
 * HTML Audio Player Implementation
 *
 * Wraps HTMLAudioElement for browser-based audio playback.
 * Preloads audio files for instant playback.
 */

import type { IAudioPlayer } from './IAudioPlayer';

export class HtmlAudioPlayer implements IAudioPlayer {
  private audioCache = new Map<string, HTMLAudioElement>();
  private volume = 1.0;

  async play(soundFile: string): Promise<void> {
    console.log('[HtmlAudioPlayer] play() called with:', soundFile);
    const audio = this.getOrCreateAudio(soundFile);

    // Reset to start if already playing or finished
    audio.currentTime = 0;

    try {
      console.log('[HtmlAudioPlayer] Attempting to play audio...');
      await audio.play();
      console.log('[HtmlAudioPlayer] Audio playing successfully');
    } catch (error) {
      // Browser may block autoplay - log but don't throw
      console.warn('[HtmlAudioPlayer] Playback blocked or failed:', error);
    }
  }

  setVolume(level: number): void {
    this.volume = Math.max(0, Math.min(1, level));

    // Update volume on all cached audio elements
    for (const audio of this.audioCache.values()) {
      audio.volume = this.volume;
    }
  }

  private getOrCreateAudio(soundFile: string): HTMLAudioElement {
    let audio = this.audioCache.get(soundFile);

    if (!audio) {
      audio = new Audio(soundFile);
      audio.volume = this.volume;
      audio.preload = 'auto';
      this.audioCache.set(soundFile, audio);
    }

    return audio;
  }
}
