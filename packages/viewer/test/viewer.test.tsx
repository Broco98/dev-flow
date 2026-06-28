import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { Viewer } from "../src/Viewer";
import { useGraphUi } from "../src/state/uiStore";
import fixtureIr from "./fixtures/express-app.ir.json";

const sized = (ui: ReactNode) => <div style={{ width: 800, height: 600 }}>{ui}</div>;

beforeEach(() => useGraphUi.setState({ selectedId: null, expanded: new Set<string>() }));

describe("Viewer", () => {
  it("shows only entrypoint nodes at the top level", async () => {
    render(sized(<Viewer ir={fixtureIr} />));
    expect(await screen.findByText("GET /users")).toBeInTheDocument();
    expect(screen.queryByText("getUsers")).not.toBeInTheDocument();
  });
});
