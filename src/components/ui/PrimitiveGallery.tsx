import { useState } from 'react';
import { Play, Trash2, Plus, Info, Settings, ShieldAlert } from 'lucide-react';
import { Button } from './Button';
import { IconButton } from './IconButton';
import { Input } from './Input';
import { NumberInput } from './NumberInput';
import { Select } from './Select';
import { Slider } from './Slider';
import { RangeSlider } from './RangeSlider';
import { Switch } from './Switch';
import { ColorSwatch } from './ColorSwatch';
import { ColorPaletteStrip } from './ColorPaletteStrip';
import { Tooltip } from './Tooltip';
import { Collapsible } from './Collapsible';
import { ScrollArea } from './ScrollArea';
import { Badge } from './Badge';
import { Divider } from './Divider';

export function PrimitiveGallery() {
  // State for interactive primitives
  const [inputText, setInputText] = useState('Sample text input');
  const [numValue, setNumValue] = useState(42);
  const [selectVal, setSelectVal] = useState('option-2');
  const [sliderVal, setSliderVal] = useState(65);
  const [rangeVal, setRangeVal] = useState<[number, number]>([20, 80]);
  const [switchChecked, setSwitchChecked] = useState(true);
  const [activeColor, setActiveColor] = useState('#4C8BF5');
  const [activePaletteIndex, setActivePaletteIndex] = useState(0);

  const sampleColors = ['#4C8BF5', '#34D399', '#FBBF24', '#F87171', '#A78BFA', '#F472B6'];
  const samplePalettes = [
    ['#0F172A', '#1E293B', '#334155', '#475569', '#64748B'],
    ['#064E3B', '#065F46', '#047857', '#059669', '#10B981'],
    ['#78350F', '#92400E', '#B45309', '#D97706', '#F59E0B'],
    ['#7F1D1D', '#991B1B', '#B91C1C', '#DC2626', '#EF4444'],
  ];

  return (
    <div className="w-full max-w-6xl mx-auto p-6 bg-bg-primary text-text-primary">
      <header className="mb-8 border-b border-border-primary pb-4">
        <h1 className="text-2xl font-bold tracking-tight">Design System Primitives</h1>
        <p className="text-text-secondary mt-1">
          Dark professional styling &amp; 4px spacing rhythm visual gallery. Contains 15 core primitives.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Row 1: Buttons & IconButtons */}
        <section className="border border-border-primary rounded bg-bg-secondary p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-4">
            1. Button &amp; 2. IconButton
          </h2>
          <div className="flex flex-col gap-4">
            {/* Variants */}
            <div>
              <div className="text-xs text-text-secondary mb-2 font-mono">Variants (Size: md)</div>
              <div className="flex flex-wrap gap-2">
                <Button variant="primary">Primary</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="danger">Danger</Button>
              </div>
            </div>
            
            {/* Sizes */}
            <div>
              <div className="text-xs text-text-secondary mb-2 font-mono">Sizes</div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="primary">Small</Button>
                <Button size="md" variant="primary">Medium</Button>
                <Button size="sm" variant="secondary">Small Sec</Button>
                <Button size="md" variant="secondary">Medium Sec</Button>
              </div>
            </div>

            {/* Disabled & Loading */}
            <div>
              <div className="text-xs text-text-secondary mb-2 font-mono">States (Disabled)</div>
              <div className="flex gap-2">
                <Button variant="primary" disabled>Disabled Pri</Button>
                <Button variant="secondary" disabled>Disabled Sec</Button>
              </div>
            </div>

            {/* Icon Buttons */}
            <div>
              <div className="text-xs text-text-secondary mb-2 font-mono">IconButtons (Ghost / Sec / Danger)</div>
              <div className="flex gap-2 items-center">
                <IconButton variant="ghost" size="sm">
                  <Play size={14} />
                </IconButton>
                <IconButton variant="ghost" size="md">
                  <Play size={16} />
                </IconButton>
                <IconButton variant="secondary" size="md">
                  <Settings size={16} />
                </IconButton>
                <IconButton variant="danger" size="md">
                  <Trash2 size={16} />
                </IconButton>
                <IconButton variant="primary" size="sm">
                  <Plus size={14} />
                </IconButton>
              </div>
            </div>
          </div>
        </section>

        {/* Row 2: Inputs */}
        <section className="border border-border-primary rounded bg-bg-secondary p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-4">
            3. Input &amp; 4. NumberInput &amp; 5. Select
          </h2>
          <div className="flex flex-col gap-4">
            {/* Standard Input */}
            <div>
              <label className="block text-xs text-text-secondary mb-1.5 font-mono">TextInput (Controlled)</label>
              <Input
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Type here..."
              />
              <span className="text-[11px] text-text-tertiary mt-1 block">Value: {inputText}</span>
            </div>

            {/* Disabled Input */}
            <div>
              <label className="block text-xs text-text-secondary mb-1.5 font-mono">Disabled Input</label>
              <Input value="Cannot edit this" disabled />
            </div>

            {/* Number Input */}
            <div>
              <label className="block text-xs text-text-secondary mb-1.5 font-mono">NumberInput (Steppers, min 0, max 100)</label>
              <NumberInput
                value={numValue}
                min={0}
                max={100}
                onChange={setNumValue}
              />
              <span className="text-[11px] text-text-tertiary mt-1 block">Value: {numValue}</span>
            </div>

            {/* Select Dropdown */}
            <div>
              <label className="block text-xs text-text-secondary mb-1.5 font-mono">Select (Native Styled)</label>
              <Select
                value={selectVal}
                onChange={(e) => setSelectVal(e.target.value)}
                options={[
                  { value: 'option-1', label: 'Scatterplot Layer' },
                  { value: 'option-2', label: 'Hexagon Layer' },
                  { value: 'option-3', label: 'Arc Layer' },
                  { value: 'option-4', label: 'Heatmap Layer' },
                ]}
              />
              <span className="text-[11px] text-text-tertiary mt-1 block">Selected: {selectVal}</span>
            </div>
          </div>
        </section>

        {/* Row 3: Sliders */}
        <section className="border border-border-primary rounded bg-bg-secondary p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-4">
            6. Slider &amp; 7. RangeSlider
          </h2>
          <div className="flex flex-col gap-5">
            {/* Single Slider */}
            <div>
              <div className="flex justify-between text-xs text-text-secondary mb-1 font-mono">
                <span>Slider (Opacity Control)</span>
                <span className="text-accent font-semibold">{sliderVal}%</span>
              </div>
              <Slider
                value={sliderVal}
                min={0}
                max={100}
                onChange={(e) => setSliderVal(Number(e.target.value))}
              />
            </div>

            {/* Disabled Slider */}
            <div>
              <div className="text-xs text-text-secondary mb-1 font-mono">Disabled Slider</div>
              <Slider value={30} disabled />
            </div>

            {/* Range Slider */}
            <div>
              <div className="flex justify-between text-xs text-text-secondary mb-1 font-mono">
                <span>RangeSlider (Radius Filter)</span>
                <span className="text-accent font-semibold">
                  [{rangeVal[0]}, {rangeVal[1]}]
                </span>
              </div>
              <RangeSlider
                min={0}
                max={100}
                value={rangeVal}
                onChange={setRangeVal}
              />
            </div>
          </div>
        </section>

        {/* Row 4: Switch, Swatch, Strip */}
        <section className="border border-border-primary rounded bg-bg-secondary p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-4">
            8. Switch &amp; 9. ColorSwatch &amp; 10. ColorPaletteStrip
          </h2>
          <div className="flex flex-col gap-4">
            {/* Toggle Switch */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-text-secondary font-mono">8. Switch (Enable 3D Terrain)</span>
              <div className="flex items-center gap-3">
                <span className="text-xs text-text-tertiary">{switchChecked ? 'ON' : 'OFF'}</span>
                <Switch
                  checked={switchChecked}
                  onChange={(e) => setSwitchChecked(e.target.checked)}
                />
              </div>
            </div>

            {/* Color Swatch */}
            <div>
              <span className="block text-xs text-text-secondary mb-2 font-mono">9. ColorSwatch (Select Theme Accent)</span>
              <div className="flex gap-2">
                {sampleColors.map((color) => (
                  <ColorSwatch
                    key={color}
                    color={color}
                    active={activeColor === color}
                    onClick={() => setActiveColor(color)}
                  />
                ))}
              </div>
              <span className="text-[11px] text-text-tertiary mt-1 block">Active Color: {activeColor}</span>
            </div>

            {/* Color Palette Strip */}
            <div>
              <span className="block text-xs text-text-secondary mb-2 font-mono">10. ColorPaletteStrip (Select Elevation Gradient)</span>
              <div className="flex flex-col gap-2">
                {samplePalettes.map((palette, idx) => (
                  <ColorPaletteStrip
                    key={idx}
                    colors={palette}
                    active={activePaletteIndex === idx}
                    onClick={() => setActivePaletteIndex(idx)}
                  />
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Row 5: Tooltip, Badge, Divider */}
        <section className="border border-border-primary rounded bg-bg-secondary p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-4">
            11. Tooltip &amp; 14. Badge &amp; 15. Divider
          </h2>
          <div className="flex flex-col gap-4">
            {/* Tooltips */}
            <div>
              <div className="text-xs text-text-secondary mb-2 font-mono">11. Tooltips (Hover to inspect)</div>
              <div className="flex gap-4">
                <Tooltip content="Useful descriptive info helper" position="top">
                  <span className="px-3 py-1.5 bg-bg-tertiary border border-border-primary rounded text-xs cursor-help inline-flex items-center gap-1">
                    <Info size={12} className="text-accent" /> Hover Top
                  </span>
                </Tooltip>

                <Tooltip content="Warns before permanent deletion" position="right">
                  <span className="px-3 py-1.5 bg-bg-tertiary border border-border-primary rounded text-xs cursor-help inline-flex items-center gap-1">
                    <ShieldAlert size={12} className="text-error" /> Hover Right
                  </span>
                </Tooltip>
              </div>
            </div>

            {/* Badges */}
            <div>
              <div className="text-xs text-text-secondary mb-2 font-mono">14. Badges (Sizes &amp; Statuses)</div>
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">Default</Badge>
                  <Badge variant="info">Info</Badge>
                  <Badge variant="success">Success</Badge>
                  <Badge variant="warning">Warning</Badge>
                  <Badge variant="error">Danger</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="success" size="sm">Small Size</Badge>
                  <Badge variant="success" size="md">Medium Size</Badge>
                </div>
              </div>
            </div>

            {/* Divider */}
            <div>
              <div className="text-xs text-text-secondary mb-1.5 font-mono">15. Divider (Horizontal &amp; Vertical)</div>
              <div className="flex flex-col gap-1.5">
                <div className="text-xs text-text-tertiary">Line above divider</div>
                <Divider />
                <div className="text-xs text-text-tertiary">Line below divider</div>
                <div className="flex items-center h-6 mt-1">
                  <span className="text-xs text-text-tertiary">Left</span>
                  <Divider orientation="vertical" />
                  <span className="text-xs text-text-tertiary">Middle</span>
                  <Divider orientation="vertical" />
                  <span className="text-xs text-text-tertiary">Right</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Row 6: Collapsible & ScrollArea */}
        <section className="border border-border-primary rounded bg-bg-secondary p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-4">
            12. Collapsible &amp; 13. ScrollArea
          </h2>
          <div className="flex flex-col gap-4">
            {/* Collapsible */}
            <div>
              <div className="text-xs text-text-secondary mb-2 font-mono">12. Collapsible</div>
              <Collapsible title="Layer Settings (Click to expand)">
                <div className="flex flex-col gap-2">
                  <div className="text-xs">Hexagon Radius: 200m</div>
                  <div className="text-xs">Elevation Scale: 5x</div>
                </div>
              </Collapsible>
            </div>

            {/* Scroll Area */}
            <div>
              <div className="text-xs text-text-secondary mb-2 font-mono">13. ScrollArea (Styled Scrollbar)</div>
              <ScrollArea maxHeight={110} className="border border-border-primary rounded p-2.5 bg-bg-primary">
                <div className="flex flex-col gap-1">
                  {Array.from({ length: 15 }).map((_, i) => (
                    <div key={i} className="text-xs py-1 border-b border-border-secondary last:border-0">
                      Sample Dataset Item #{i + 1} - Coordinate details matching NYC trees dataset format.
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}
