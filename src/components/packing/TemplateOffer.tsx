interface TemplateOfferProps {
  itemCount: number;
  name: string;
  onAccept: () => void;
  onSkip: () => void;
}

export function TemplateOffer({ itemCount, name, onAccept, onSkip }: TemplateOfferProps) {
  return (
    <section class="card template-offer" aria-labelledby="template-offer-title">
      <p class="template-offer__emoji" aria-hidden="true">
        🎒
      </p>
      <div>
        <h2 id="template-offer-title">Want a head start, {name}?</h2>
        <p>
          Add {itemCount} common ski-trip items: layers, gloves, sunscreen, chargers and more. You
          can edit or delete any of them.
        </p>
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
