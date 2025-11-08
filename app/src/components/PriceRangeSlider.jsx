import * as React from 'react';
import * as Slider from '@radix-ui/react-slider';

export function PriceRangeSlider({
  min = 0,
  max = 3000,
  step = 100,
  value,
  onChange,
  formatPrice,
  currentTheme = 'default',
  theme,
}) {
  const [internal, setInternal] = React.useState([value?.[0] ?? min, value?.[1] ?? max]);

  const handleChange = (v) => {
    const next = [v[0], v[1]];
    setInternal(next);
    onChange?.(next);
  };

  const current = value ?? internal;

  // Theme-based colors
  const isSteamTheme = currentTheme === 'steam';
  const trackBgColor = currentTheme === 'dark' ? 'bg-gray-700' : 'bg-gray-200';
  const rangeBgColor = isSteamTheme ? 'bg-[#4668FF]' : currentTheme === 'dark' ? 'bg-gray-400' : 'bg-gray-800';
  const thumbBgColor = isSteamTheme ? 'bg-[#4668FF]' : 'bg-white';
  const thumbBorderColor = isSteamTheme ? 'border-[#4668FF]' : currentTheme === 'dark' ? 'border-gray-500' : 'border-gray-400';

  return (
    <div className="w-full select-none">
      {/* Price Range Display */}
      <div className={`flex items-center justify-between text-sm mb-2 ${theme?.subText || 'text-gray-600'}`}>
        <span>{formatPrice(current[0])}</span>
        <span>{formatPrice(current[1])}</span>
      </div>

      {/* Slider */}
      <Slider.Root
        className="relative flex h-6 w-full touch-none items-center"
        min={min}
        max={max}
        step={step}
        value={current}
        onValueChange={handleChange}
        minStepsBetweenThumbs={1}
      >
        <Slider.Track className={`relative h-2 w-full grow rounded-full ${trackBgColor}`}>
          <Slider.Range className={`absolute h-2 rounded-full ${rangeBgColor}`} />
        </Slider.Track>

        <Slider.Thumb
          aria-label="Minimum price"
          className={`block h-5 w-5 rounded-full border-2 ${thumbBorderColor} ${thumbBgColor} shadow focus:outline-none hover:ring-2 hover:ring-offset-2 ${isSteamTheme ? 'hover:ring-[#4668FF]' : 'hover:ring-gray-400'}`}
        />
        <Slider.Thumb
          aria-label="Maximum price"
          className={`block h-5 w-5 rounded-full border-2 ${thumbBorderColor} ${thumbBgColor} shadow focus:outline-none hover:ring-2 hover:ring-offset-2 ${isSteamTheme ? 'hover:ring-[#4668FF]' : 'hover:ring-gray-400'}`}
        />
      </Slider.Root>
    </div>
  );
}
