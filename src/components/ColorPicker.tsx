import React, { useState, useRef, useCallback, useEffect } from 'react';
import './ColorPicker.css';

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  label?: string;
}

interface HSV {
  h: number;
  s: number;
  v: number;
}

interface RGBA {
  r: number;
  g: number;
  b: number;
  a: number;
}

const ColorPicker: React.FC<ColorPickerProps> = React.memo(({ value, onChange, label }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [hsv, setHsv] = useState<HSV>({ h: 0, s: 100, v: 100 });
  const [alpha, setAlpha] = useState(1);
  const [isDragging, setIsDragging] = useState<'hue' | 'satval' | 'alpha' | null>(null);
  
  // Store original color when picker opens
  const [originalColor, setOriginalColor] = useState(value);
  const [previewHsv, setPreviewHsv] = useState<HSV>({ h: 0, s: 100, v: 100 });
  const [previewAlpha, setPreviewAlpha] = useState(1);
  
  // Position state for fixed positioning
  const [popupPosition, setPopupPosition] = useState({ top: 0, left: 0 });
  
  const hueBarRef = useRef<HTMLDivElement>(null);
  const satValRef = useRef<HTMLDivElement>(null);
  const alphaBarRef = useRef<HTMLDivElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const swatchRef = useRef<HTMLButtonElement>(null);

  // Convert hex/rgba to RGBA object
  const parseColor = useCallback((color: string): RGBA => {
    if (color.startsWith('#')) {
      const hex = color.slice(1);
      if (hex.length === 3) {
        const r = parseInt(hex[0] + hex[0], 16);
        const g = parseInt(hex[1] + hex[1], 16);
        const b = parseInt(hex[2] + hex[2], 16);
        return { r, g, b, a: 1 };
      } else if (hex.length === 6) {
        const r = parseInt(hex.slice(0, 2), 16);
        const g = parseInt(hex.slice(2, 4), 16);
        const b = parseInt(hex.slice(4, 6), 16);
        return { r, g, b, a: 1 };
      }
    } else if (color.startsWith('rgba')) {
      const match = color.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/);
      if (match) {
        return {
          r: parseInt(match[1]),
          g: parseInt(match[2]),
          b: parseInt(match[3]),
          a: parseFloat(match[4])
        };
      }
    } else if (color.startsWith('rgb')) {
      const match = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
      if (match) {
        return {
          r: parseInt(match[1]),
          g: parseInt(match[2]),
          b: parseInt(match[3]),
          a: 1
        };
      }
    }
    return { r: 255, g: 255, b: 255, a: 1 };
  }, []);

  // Convert RGBA to HSV
  const rgbaToHsv = useCallback((rgba: RGBA): HSV => {
    const r = rgba.r / 255;
    const g = rgba.g / 255;
    const b = rgba.b / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const diff = max - min;

    let h = 0;
    if (diff !== 0) {
      if (max === r) {
        h = ((g - b) / diff) % 6;
      } else if (max === g) {
        h = (b - r) / diff + 2;
      } else {
        h = (r - g) / diff + 4;
      }
    }
    h = Math.round(h * 60);
    if (h < 0) h += 360;

    const s = max === 0 ? 0 : Math.round((diff / max) * 100);
    const v = Math.round(max * 100);

    return { h, s, v };
  }, []);

  // Convert HSV to RGBA
  const hsvToRgba = useCallback((hsv: HSV, alpha: number): RGBA => {
    const h = hsv.h / 60;
    const s = hsv.s / 100;
    const v = hsv.v / 100;

    const c = v * s;
    const x = c * (1 - Math.abs((h % 2) - 1));
    const m = v - c;

    let r = 0, g = 0, b = 0;

    if (h >= 0 && h < 1) {
      r = c; g = x; b = 0;
    } else if (h >= 1 && h < 2) {
      r = x; g = c; b = 0;
    } else if (h >= 2 && h < 3) {
      r = 0; g = c; b = x;
    } else if (h >= 3 && h < 4) {
      r = 0; g = x; b = c;
    } else if (h >= 4 && h < 5) {
      r = x; g = 0; b = c;
    } else if (h >= 5 && h < 6) {
      r = c; g = 0; b = x;
    }

    return {
      r: Math.round((r + m) * 255),
      g: Math.round((g + m) * 255),
      b: Math.round((b + m) * 255),
      a: alpha
    };
  }, []);

  // Format RGBA to string
  const formatColor = useCallback((rgba: RGBA): string => {
    if (rgba.a < 1) {
      return `rgba(${rgba.r}, ${rgba.g}, ${rgba.b}, ${rgba.a})`;
    } else {
      const toHex = (n: number) => n.toString(16).padStart(2, '0');
      return `#${toHex(rgba.r)}${toHex(rgba.g)}${toHex(rgba.b)}`;
    }
  }, []);

  // Initialize color from prop
  useEffect(() => {
    const rgba = parseColor(value);
    const newHsv = rgbaToHsv(rgba);
    setHsv(newHsv);
    setAlpha(rgba.a);
    setPreviewHsv(newHsv);
    setPreviewAlpha(rgba.a);
  }, [value, parseColor, rgbaToHsv]);

  // Update preview color (don't call onChange yet)
  const updatePreview = useCallback((newHsv: HSV, newAlpha: number) => {
    setPreviewHsv(newHsv);
    setPreviewAlpha(newAlpha);
  }, []);
  
  // Apply the color change
  const applyColor = useCallback(() => {
    const rgba = hsvToRgba(previewHsv, previewAlpha);
    onChange(formatColor(rgba));
    setHsv(previewHsv);
    setAlpha(previewAlpha);
    setIsOpen(false);
  }, [previewHsv, previewAlpha, hsvToRgba, formatColor, onChange]);
  
  // Cancel and revert to original color
  // Calculate optimal popup position
  const calculatePosition = useCallback(() => {
    if (!swatchRef.current) return { top: 0, left: 0 };
    
    const swatchRect = swatchRef.current.getBoundingClientRect();
    const popupWidth = 240;
    const popupHeight = 280; // Approximate height including buttons
    
    // Start with default position below the swatch
    let top = swatchRect.bottom + 4;
    let left = swatchRect.left;
    
    // Check if popup would go off the right edge of the screen
    if (left + popupWidth > window.innerWidth) {
      left = window.innerWidth - popupWidth - 10; // 10px margin from edge
    }
    
    // Check if popup would go off the bottom of the screen
    if (top + popupHeight > window.innerHeight) {
      // Position above the swatch instead
      top = swatchRect.top - popupHeight - 4;
    }
    
    // Ensure popup doesn't go off the top of the screen
    if (top < 10) {
      top = 10;
    }
    
    // Ensure popup doesn't go off the left edge
    if (left < 10) {
      left = 10;
    }
    
    return { top, left };
  }, []);

  const cancelColor = useCallback(() => {
    const rgba = parseColor(originalColor);
    const originalHsv = rgbaToHsv(rgba);
    setPreviewHsv(originalHsv);
    setPreviewAlpha(rgba.a);
    setHsv(originalHsv);
    setAlpha(rgba.a);
    setIsOpen(false);
  }, [originalColor, parseColor, rgbaToHsv]);

  // Handle mouse down on saturation/value area
  const handleSatValMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Set dragging state immediately to prevent picker from closing
    setIsDragging('satval');

    if (satValRef.current) {
      const rect = satValRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
      const y = Math.max(0, Math.min(rect.height, e.clientY - rect.top));
      const newS = Math.round((x / rect.width) * 100);
      const newV = Math.round((1 - y / rect.height) * 100);
      const newHsv = { ...previewHsv, s: newS, v: newV };
      updatePreview(newHsv, previewAlpha);
    }
  }, [previewHsv, previewAlpha, updatePreview]);

  // Handle mouse down on hue bar
  const handleHueMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Set dragging state immediately to prevent picker from closing
    setIsDragging('hue');

    if (hueBarRef.current) {
      const rect = hueBarRef.current.getBoundingClientRect();
      const y = Math.max(0, Math.min(rect.height, e.clientY - rect.top));
      const newH = Math.round((y / rect.height) * 360);
      const newHsv = { ...previewHsv, h: newH };
      updatePreview(newHsv, previewAlpha);
    }
  }, [previewHsv, previewAlpha, updatePreview]);

  // Handle mouse down on alpha bar
  const handleAlphaMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Set dragging state immediately to prevent picker from closing
    setIsDragging('alpha');

    if (alphaBarRef.current) {
      const rect = alphaBarRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
      const newAlpha = Math.round((x / rect.width) * 100) / 100;
      updatePreview(previewHsv, newAlpha);
    }
  }, [previewHsv, updatePreview]);

  // Global mouse move and mouse up handlers
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;

      if (isDragging === 'satval' && satValRef.current) {
        const rect = satValRef.current.getBoundingClientRect();
        const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
        const y = Math.max(0, Math.min(rect.height, e.clientY - rect.top));
        const newS = Math.round((x / rect.width) * 100);
        const newV = Math.round((1 - y / rect.height) * 100);
        const newHsv = { ...previewHsv, s: newS, v: newV };
        updatePreview(newHsv, previewAlpha);
      } else if (isDragging === 'hue' && hueBarRef.current) {
        const rect = hueBarRef.current.getBoundingClientRect();
        const y = Math.max(0, Math.min(rect.height, e.clientY - rect.top));
        const newH = Math.round((y / rect.height) * 360);
        const newHsv = { ...previewHsv, h: newH };
        updatePreview(newHsv, previewAlpha);
      } else if (isDragging === 'alpha' && alphaBarRef.current) {
        const rect = alphaBarRef.current.getBoundingClientRect();
        const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
        const newAlpha = Math.round((x / rect.width) * 100) / 100;
        updatePreview(previewHsv, newAlpha);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(null);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, previewHsv, previewAlpha, updatePreview]);

  // Handle click outside to close (only when not dragging)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Don't close while dragging
      if (isDragging) return;
      
      const target = event.target as Node;
      
      // Check if the click target is within the picker container or popup
      const isInContainer = pickerRef.current?.contains(target);
      const popup = document.querySelector('.color-picker-popup');
      const isInPopup = popup?.contains(target);
      
      if (!isInContainer && !isInPopup) {
        setIsOpen(false);
      }
    };

    const handleResize = () => {
      if (isOpen && swatchRef.current) {
        const position = calculatePosition();
        setPopupPosition(position);
      }
    };

    if (isOpen && !isDragging) {
      // Delay adding the listener to avoid immediate close and only add when not dragging
      const timer = setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside);
        window.addEventListener('resize', handleResize);
        window.addEventListener('scroll', handleResize, true);
      }, 100);
      
      return () => {
        clearTimeout(timer);
        document.removeEventListener('mousedown', handleClickOutside);
        window.removeEventListener('resize', handleResize);
        window.removeEventListener('scroll', handleResize, true);
      };
    }
  }, [isOpen, isDragging, calculatePosition]);

  const currentRgba = hsvToRgba(hsv, alpha);
  const currentColor = formatColor(currentRgba);
  const previewRgba = hsvToRgba(previewHsv, previewAlpha);
  const previewColor = formatColor(previewRgba);

  return (
    <div className="color-picker-container" ref={pickerRef}>
      {label && <label className="color-picker-label">{label}</label>}
      
      <button
        ref={swatchRef}
        className="color-picker-swatch"
        onClick={(e) => {
          e.stopPropagation();
          if (!isOpen) {
            // Store the original color when opening
            setOriginalColor(currentColor);
            // Calculate and set position
            const position = calculatePosition();
            setPopupPosition(position);
          }
          setIsOpen(!isOpen);
        }}
        style={{ backgroundColor: currentColor }}
      >
        <div className="color-picker-checkerboard" />
        <div className="color-picker-color" style={{ backgroundColor: currentColor }} />
      </button>

      {isOpen && (
        <div 
          className="color-picker-popup"
          style={{
            top: `${popupPosition.top}px`,
            left: `${popupPosition.left}px`
          }}
        >
          <div className="color-picker-main">
            <div
              ref={satValRef}
              className="color-picker-saturation"
              style={{ backgroundColor: `hsl(${previewHsv.h}, 100%, 50%)` }}
              onMouseDown={handleSatValMouseDown}
            >
              <div className="color-picker-saturation-white">
                <div className="color-picker-saturation-black">
                  <div
                    className="color-picker-cursor"
                    style={{
                      left: `${previewHsv.s}%`,
                      top: `${100 - previewHsv.v}%`,
                    }}
                  />
                </div>
              </div>
            </div>

            <div
              ref={hueBarRef}
              className="color-picker-hue"
              onMouseDown={handleHueMouseDown}
            >
              <div
                className="color-picker-hue-cursor"
                style={{ top: `${(previewHsv.h / 360) * 100}%` }}
              />
            </div>
          </div>

          <div
            ref={alphaBarRef}
            className="color-picker-alpha"
            onMouseDown={handleAlphaMouseDown}
          >
            <div className="color-picker-alpha-checkerboard" />
            <div
              className="color-picker-alpha-gradient"
              style={{
                background: `linear-gradient(to right, transparent, rgb(${previewRgba.r}, ${previewRgba.g}, ${previewRgba.b}))`
              }}
            />
            <div
              className="color-picker-alpha-cursor"
              style={{ left: `${previewAlpha * 100}%` }}
            />
          </div>

          <div className="color-picker-preview">
            <div className="color-picker-preview-checkerboard" />
            <div
              className="color-picker-preview-color"
              style={{ backgroundColor: previewColor }}
            />
            <span className="color-picker-preview-text">{previewColor}</span>
          </div>

          <div className="color-picker-buttons">
            <button 
              className="color-picker-button cancel"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                cancelColor();
              }}
              type="button"
            >
              Cancel
            </button>
            <button 
              className="color-picker-button apply"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                applyColor();
              }}
              type="button"
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
});

ColorPicker.displayName = 'ColorPicker';

export default ColorPicker;