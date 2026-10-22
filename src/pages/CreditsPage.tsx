import { PageHeader } from '../components/PageHeader';
import { DISH_IMAGES } from '../data/dishImages';
import { findDish } from '../data/dishes';
import { href } from '../lib/router/hashRouter';

const EXTERNAL = { target: '_blank', rel: 'noopener noreferrer' } as const;

/** Every third-party asset we use, with the attribution its licence asks for. */
export default function CreditsPage() {
  return (
    <>
      <PageHeader title="Credits" subtitle="Thank you to everyone whose work this site uses." />

      <section aria-labelledby="credits-photos">
        <h2 id="credits-photos" class="section-title">
          Food photos
        </h2>
        <p class="credits-intro">
          From Wikimedia Commons. We cropped them to 4:3 and resized them. Dishes without a suitable
          freely licensed photo show an illustration.
        </p>
        <ul class="credits-list">
          {DISH_IMAGES.map((image) => (
            <li key={image.id}>
              <a href={href(`/food/${image.id}`)}>{findDish(image.id)?.name ?? image.id}</a>:{' '}
              <a href={image.sourceUrl} {...EXTERNAL}>
                photo
              </a>{' '}
              by {image.author},{' '}
              {image.licenseUrl ? (
                <a href={image.licenseUrl} {...EXTERNAL}>
                  {image.license}
                </a>
              ) : (
                image.license
              )}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="credits-data">
        <h2 id="credits-data" class="section-title">
          Maps and data
        </h2>
        <ul class="credits-list">
          <li>
            Map data ©{' '}
            <a href="https://www.openstreetmap.org/copyright" {...EXTERNAL}>
              OpenStreetMap contributors
            </a>
            , ODbL. The map artwork is our own.
          </li>
          <li>
            <a href="https://open-meteo.com/" {...EXTERNAL}>
              Weather data by Open-Meteo.com
            </a>{' '}
            (CC BY 4.0). Snow depth is a model estimate.
          </li>
          <li>
            Exchange rates:{' '}
            <a href="https://nbg.gov.ge/en/monetary-policy/currency" {...EXTERNAL}>
              National Bank of Georgia
            </a>
            ; fallback{' '}
            <a href="https://www.exchangerate-api.com" {...EXTERNAL}>
              Rates by Exchange Rate API
            </a>
            .
          </li>
          <li>Live cams: Vitamin Cafe Gudauri streams on YouTube.</li>
          <li>
            Georgian words checked against{' '}
            <a href="https://en.wiktionary.org/" {...EXTERNAL}>
              Wiktionary
            </a>
            .
          </li>
          <li>
            Display font Fredoka (SIL Open Font License). Assistant answers by Meta Llama 3.1 on
            Cloudflare Workers AI.
          </li>
        </ul>
      </section>
    </>
  );
}
