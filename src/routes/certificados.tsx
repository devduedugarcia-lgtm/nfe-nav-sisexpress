import { createFileRoute } from "@tanstack/react-router";
import Certificados from "../pages/Certificados";

export const Route = createFileRoute("/certificados")({
  component: Certificados,
});