import { useEffect, useRef, useState } from 'react';
import type { AcousticChannelType, Level1Status } from '../lib/clinical';
import { CHART } from '../theme/glass';

export interface FrequencyChartData {
  fftBins: number[];
  fundamentalFreqHz: number;
  spectralCentroidHz: number;
  zeroCrossingRate: number;
  peakRmsEnergy?: number;
}

interface FftSpectrumChartProps {
  frequencyChartData: FrequencyChartData | null;
  level1Status: Level1Status | null;
  theme?: 'light' | 'dark';
  activeChannel: AcousticChannelType;
  isPlaying: boolean;
  playbackProgress: number;
  /**
   * Compact presentation used inside the Assessment tab: the same drawing, sized
   * to its container, without axes or readouts. The full chart (Analysis tab)
   * keeps its labelled axes and biomarker header.
   */
  compact?: boolean;
}

export function FftSpectrumChart({
  frequencyChartData,
  level1Status,
  theme = 'light',
  activeChannel,
  isPlaying,
  playbackProgress,
  compact = false,
}: FftSpectrumChartProps) {
  const ink = CHART[theme];
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const drawRef = useRef<(() => void) | null>(null);
  const [hoverInfo, setHoverInfo] = useState<{
    binIndex: number;
    freqHz: number;
    magnitudePct: number;
    dbValue: number;
    x: number;
  } | null>(null);

  const activeBins = frequencyChartData?.fftBins ?? [];

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      const rect = container.getBoundingClientRect();
      const width = Math.max(1, Math.floor(rect.width));
      const height = compact ? Math.max(72, Math.floor(rect.height)) : 200;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      const pixelWidth = Math.floor(width * dpr);
      const pixelHeight = Math.floor(height * dpr);
      if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
      if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      ctx.clearRect(0, 0, width, height);
      if (!frequencyChartData || activeBins.length === 0 || width < 64) return;

      const padLeft = compact ? 8 : 36;
      const padRight = compact ? 8 : 14;
      const padTop = compact ? 8 : 18;
      const padBottom = compact ? 8 : 26;
      const plotW = width - padLeft - padRight;
      const plotH = height - padTop - padBottom;

      if (!compact) {
        // Grid lines (dB / normalized magnitude)
        ctx.strokeStyle = ink.grid;
        ctx.lineWidth = 1;
        ctx.font = '500 10px "IBM Plex Mono", monospace';
        ctx.fillStyle = ink.axis;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';

        const yTicks = [
          { ratio: 0, label: '0 dB' },
          { ratio: 0.5, label: '-24' },
          { ratio: 1, label: '-48' },
        ];
        for (const tick of yTicks) {
          const y = padTop + tick.ratio * plotH;
          ctx.beginPath();
          ctx.moveTo(padLeft, y);
          ctx.lineTo(width - padRight, y);
          ctx.stroke();
          ctx.fillText(tick.label, padLeft - 6, y);
        }

        // Frequency X-axis ticks (0 - 8000 Hz)
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        const xFreqs = [0, 1000, 2000, 4000, 6000, 8000];
        for (const freq of xFreqs) {
          const x = padLeft + (freq / 8000) * plotW;
          ctx.beginPath();
          ctx.strokeStyle = ink.gridSoft;
          ctx.moveTo(x, padTop);
          ctx.lineTo(x, padTop + plotH);
          ctx.stroke();
          ctx.fillStyle = ink.axis;
          ctx.fillText(freq === 0 ? '0' : `${freq / 1000}k`, x, padTop + plotH + 6);
        }
      }

      // Clinical ink: restrained status tones from the console palette. The
      // status is carried by the bar tint and envelope line; interaction is
      // always lavender, so no saturated red/navy plate remains.
      const tone = level1Status === 'urgent' ? 'urgent' : level1Status === 'normal' ? 'normal' : 'monitor';
      const primaryColor = ink.line[tone];
      const primaryRgb = ink.bars[tone];

      // Real-time playhead spectral shimmer synchronized with audio playhead
      const binCount = activeBins.length;
      const barWidth = plotW / binCount;
      const animatedBins = activeBins.map((val, idx) => {
        if (!isPlaying && playbackProgress === 0) return val;
        // Modulate bins around traveling playhead harmonic ripple
        const timePhase = playbackProgress * Math.PI * 10;
        const binHarmonic = Math.sin(idx * 0.45 + timePhase) * 0.065 + Math.cos(idx * 0.21 - timePhase * 1.3) * 0.04;
        const energyLift = isPlaying ? 0.045 : 0.015;
        return Math.max(0.03, Math.min(1, val + binHarmonic + energyLift));
      });

      // Draw FFT Bars
      for (let i = 0; i < binCount; i++) {
        const mag = animatedBins[i];
        const barH = mag * plotH;
        const x = padLeft + i * barWidth + 1;
        const y = padTop + plotH - barH;
        const w = Math.max(2, barWidth - 2);

        const isHovered = hoverInfo?.binIndex === i;
        ctx.fillStyle = isHovered
          ? ink.hoverInk
          : `rgba(${primaryRgb}, ${(ink.barBase + mag * ink.barRange).toFixed(2)})`;
        ctx.fillRect(x, y, w, barH);
      }

      // Smooth Spectral Envelope Curve over FFT bins
      ctx.beginPath();
      ctx.strokeStyle = primaryColor;
      ctx.lineWidth = compact ? 1.25 : 1.75;
      for (let i = 0; i < binCount; i++) {
        const x = padLeft + (i + 0.5) * barWidth;
        const y = padTop + plotH - animatedBins[i] * plotH;
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          const prevX = padLeft + (i - 0.5) * barWidth;
          const prevY = padTop + plotH - animatedBins[i - 1] * plotH;
          const midX = (prevX + x) / 2;
          ctx.quadraticCurveTo(prevX, prevY, midX, (prevY + y) / 2);
        }
      }
      ctx.stroke();

      // Spectral Centroid vertical marker
      const centroidX = padLeft + (frequencyChartData.spectralCentroidHz / 8000) * plotW;
      ctx.save();
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = ink.centroid;
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      ctx.moveTo(centroidX, padTop);
      ctx.lineTo(centroidX, padTop + plotH);
      ctx.stroke();
      ctx.restore();

      if (!compact) {
        ctx.fillStyle = ink.label;
        ctx.font = '600 10px "IBM Plex Mono", monospace';
        ctx.textAlign = centroidX > width - 95 ? 'right' : 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(
          `SC ${frequencyChartData.spectralCentroidHz} Hz`,
          centroidX > width - 95 ? centroidX - 5 : centroidX + 5,
          padTop + 2
        );
      }

      // Synchronized Playhead Sweeper Marker across timeline progress
      if (isPlaying || playbackProgress > 0) {
        const playX = padLeft + playbackProgress * plotW;
        ctx.strokeStyle = ink.playhead;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(playX, padTop);
        ctx.lineTo(playX, padTop + plotH);
        ctx.stroke();
      }
    };

    drawRef.current = draw;
    draw();
  }, [
    activeBins,
    activeChannel,
    compact,
    frequencyChartData,
    hoverInfo,
    ink,
    isPlaying,
    level1Status,
    playbackProgress,
  ]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() => drawRef.current?.());
    observer.observe(container);
    return () => observer.disconnect();
  }, [compact]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const padLeft = compact ? 8 : 36;
    const padRight = compact ? 8 : 14;
    const plotW = rect.width - padLeft - padRight;
    if (x < padLeft || x > rect.width - padRight || plotW <= 0) {
      setHoverInfo(null);
      return;
    }

    if (activeBins.length === 0) {
      setHoverInfo(null);
      return;
    }
    const ratio = (x - padLeft) / plotW;
    const binIndex = Math.max(0, Math.min(activeBins.length - 1, Math.floor(ratio * activeBins.length)));
    const mag = activeBins[binIndex] ?? 0;
    const freqHz = Math.round(((binIndex + 0.5) * 8000) / activeBins.length);
    const dbValue = Number((-48 * (1 - mag)).toFixed(1));

    setHoverInfo({
      binIndex,
      freqHz,
      magnitudePct: Math.round(mag * 100),
      dbValue,
      x,
    });
  };

  /* ------------------------------------------------------- compact panel -- */
  if (compact) {
    return (
      <div ref={containerRef} className="sp-chart-stage" style={{ height: 122, background: ink.stage }}>
        <canvas
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverInfo(null)}
          aria-label="Stored screening frequency spectrum"
        />
        {hoverInfo && (
          <div className="sp-chart-readout" style={{ left: `clamp(4px, ${hoverInfo.x - 44}px, calc(100% - 88px))` }}>
            {hoverInfo.freqHz} Hz · {hoverInfo.dbValue} dB
          </div>
        )}
      </div>
    );
  }

  return (
    <section aria-label="FFT Frequency Spectrum and Formant Chart" className="sp-chart">
      <div className="sp-chart-head">
        <div>
          <h3 className="sp-chart-title">Stored frequency spectrum</h3>
          <p className="sp-chart-sub">
            Cough spectrum (0–8 kHz) with recorded voice fundamental frequency.
          </p>
        </div>

        {/* Acoustic biomarker readouts */}
        <div className="sp-chart-metrics">
          <div className="sp-chart-metric">
            <span>Fundamental F0</span>
            <strong>{frequencyChartData ? `${frequencyChartData.fundamentalFreqHz} Hz` : '—'}</strong>
          </div>
          <div className="sp-chart-metric">
            <span>Spectral Centroid</span>
            <strong>{frequencyChartData ? `${frequencyChartData.spectralCentroidHz} Hz` : '—'}</strong>
          </div>
          <div className="sp-chart-metric">
            <span>Zero Crossing Rate</span>
            <strong>{frequencyChartData ? frequencyChartData.zeroCrossingRate.toFixed(3) : '—'}</strong>
          </div>
        </div>
      </div>

      {/* Interactive canvas stage */}
      <div ref={containerRef} className="sp-chart-stage" style={{ background: ink.stage }}>
        <canvas
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverInfo(null)}
          aria-label="Stored cough frequency spectrum"
        />

        {hoverInfo && (
          <div className="sp-chart-readout" style={{ left: `clamp(8px, ${hoverInfo.x - 52}px, calc(100% - 172px))` }}>
            {hoverInfo.freqHz} Hz · {hoverInfo.dbValue} dB ({hoverInfo.magnitudePct}%)
          </div>
        )}
      </div>
    </section>
  );
}
