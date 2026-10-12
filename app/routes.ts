import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/cover.tsx"),
  route("evidence", "routes/evidence.tsx"),
  route("dossier", "routes/dossier.tsx"),
  route("photo", "routes/photo.tsx"),
  route("check", "routes/check.tsx"),
  route("invitation", "routes/invitation.tsx"),
  route("seat", "routes/seat.tsx"),
  route("pass", "routes/pass.tsx"),
  route("guests/:key", "routes/guests.tsx"),
] satisfies RouteConfig;
