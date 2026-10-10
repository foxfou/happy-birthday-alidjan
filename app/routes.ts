import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/cover.tsx"),
  route("dossier", "routes/dossier.tsx"),
  route("check", "routes/check.tsx"),
  route("invitation", "routes/invitation.tsx"),
  route("seat", "routes/seat.tsx"),
] satisfies RouteConfig;
