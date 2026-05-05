// Phase 0 HUD: FPS, frame time, helicopter altitude. Phase 1+ adds chunk count
// and draw calls per CLAUDE.md §Testing.
export class Hud {
  private readonly el: HTMLElement;
  private frames = 0;
  private accum = 0;
  private fps = 0;
  private msPerFrame = 0;

  constructor(elementId: string) {
    const el = document.getElementById(elementId);
    if (!el) throw new Error(`Hud: element #${elementId} not found`);
    this.el = el;
  }

  tick(dt: number): void {
    this.frames++;
    this.accum += dt;
    if (this.accum >= 0.5) {
      this.fps = this.frames / this.accum;
      this.msPerFrame = (this.accum * 1000) / this.frames;
      this.frames = 0;
      this.accum = 0;
    }
  }

  render(altitude: number, headingDeg: number): void {
    this.el.textContent =
      `FPS  ${this.fps.toFixed(0).padStart(3, ' ')}  ${this.msPerFrame.toFixed(2)} ms\n` +
      `ALT  ${altitude.toFixed(1)} m\n` +
      `HDG  ${headingDeg.toFixed(0).padStart(3, ' ')}°\n` +
      `WASD/Arrows: fly  Space/Shift: climb/descend`;
  }
}
