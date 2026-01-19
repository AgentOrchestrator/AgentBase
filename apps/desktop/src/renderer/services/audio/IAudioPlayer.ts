/**
 * Audio Player Interface
 *
 * Abstraction for audio playback to enable testability.
 * Implementations can wrap browser APIs or provide mock behavior.
 */

export interface IAudioPlayer {
  /**
   * Play a sound file.
   * @param soundFile - Path or URL to the sound file
   */
  play(soundFile: string): Promise<void>;

  /**
   * Set the playback volume.
   * @param level - Volume level from 0 (muted) to 1 (full volume)
   */
  setVolume(level: number): void;
}
