interface TemplateOfferProps {
  heading: string;
  description: string;
  emoji: string;
  onAccept: () => void;
  onSkip: () => void;
}

/** One-time offer to fill an empty list with starter items. */
export function TemplateOffer({
  heading,
  description,
  emoji,
  onAccept,
  onSkip,
}: TemplateOfferProps) {
  return (
    <section class="card template-offer" aria-labelledby="template-offer-title">
      <p class="template-offer__emoji" aria-hidden="true">
        {emoji}
      </p>
      <div>
        <h2 id="template-offer-title">{heading}</h2>
        <p>{description}</p>
        <div class="button-row">
          <button type="button" class="button button--primary" onClick={onAccept}>
            Add starter items
          </button>
          <button type="button" class="button" onClick={onSkip}>
            No thanks
          </button>
        </div>
      </div>
    </section>
  );
}
