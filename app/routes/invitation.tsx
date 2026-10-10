import { Link } from "react-router";

import type { Route } from "./+types/invitation";
import { Stage } from "~/components/stage";
import { EVENT } from "~/config";
import { requireGuest } from "~/lib/guest";
import { sfx } from "~/lib/sfx";

export function clientLoader() {
  return requireGuest();
}

export default function Invitation({
  loaderData: guest,
}: Route.ComponentProps) {
  const weekday = EVENT.weekday[0].toUpperCase() + EVENT.weekday.slice(1);

  return (
    <Stage title={`${guest.name}, вы приглашены`}>
      <div className="card">
        <p className="m-0">{EVENT.host} зовёт вас на день рождения</p>
        <time dateTime={EVENT.iso}>
          <span className="when">
            {weekday}, {EVENT.date}
          </span>
          <span className="time">в {EVENT.time}</span>
        </time>
        <dl className="facts">
          <div>
            <dt>Место</dt>
            <dd>{EVENT.place}</dd>
          </div>
          {EVENT.dress && (
            <div>
              <dt>Дресс-код</dt>
              <dd>{EVENT.dress}</dd>
            </div>
          )}
        </dl>
      </div>
      <p className="muted">Осталось занять место за столом.</p>
      <Link className="btn" to="/seat" onClick={() => sfx.rustle()}>
        Выбрать место
      </Link>
    </Stage>
  );
}
