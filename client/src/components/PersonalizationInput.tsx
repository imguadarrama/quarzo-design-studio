type PersonalizationInputProps = {
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
};

export function PersonalizationInput({
  value,
  onChange,
  maxLength = 80,
}: PersonalizationInputProps) {
  return (
    <div className="space-y-3">
      <label htmlFor="personalization" className="text-sm uppercase tracking-[0.25em] text-stone-500">
        Texto de personalizacion
      </label>
      <textarea
        id="personalization"
        value={value}
        maxLength={maxLength}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Ej. Familia Garcia, Sofia, Gracias por acompanarnos..."
        className="min-h-32 w-full rounded-3xl border border-stone-200 bg-white px-4 py-4 text-sm leading-6 text-stone-800 outline-none transition focus:border-stone-900"
      />
      <p className="text-right text-xs text-stone-500">
        {value.length}/{maxLength}
      </p>
    </div>
  );
}
