import { useEffect } from "react";
import { Link, useNavigate } from "react-router";

import { Stage } from "~/components/stage";
import { EVENT } from "~/config";
import { loadGuest } from "~/lib/guest";
import { sfx } from "~/lib/sfx";

export default function Cover() {
  const navigate = useNavigate();

  // Гость, уже занявший место, сразу возвращается к своему пропуску.
  useEffect(() => {
    if (loadGuest()?.seat) navigate("/pass", { replace: true });
  }, [navigate]);

  return (
    <Stage level={1} title="Закрытое мероприятие">
      <span className="stamp hero">Секретно</span>
      <dl className="facts cover">
        <div>
          <dt>Объект</dt>
          <dd>День рождения {EVENT.host}</dd>
        </div>
        <div>
          <dt>Уровень доступа</dt>
          <dd>Только по допуску</dd>
        </div>
        <div>
          <dt>Ваш допуск</dt>
          <dd>Не оформлен</dd>
        </div>
      </dl>
      <p className="muted">
        Чтобы получить приглашение, заполните досье на себя. Это займёт минуту.
      </p>
      <Link className="btn" to="/dossier" onClick={() => sfx.rustle()}>
        Оформить допуск
      </Link>
      <p className="note" aria-hidden="true">
        Не терять! Только для своих.
      </p>
    </Stage>
  );
}
