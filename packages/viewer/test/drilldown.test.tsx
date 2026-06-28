import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { Viewer } from "../src/Viewer";
import { useGraphUi } from "../src/state/uiStore";
import fixtureIr from "./fixtures/express-app.ir.json";

const sized = (ui: ReactNode) => <div style={{ width: 800, height: 600 }}>{ui}</div>;

beforeEach(() => useGraphUi.setState({ selectedId: null, expanded: new Set<string>() }));

describe("drill-down", () => {
  it("reveals the handler function when its entrypoint is clicked", async () => {
    const user = userEvent.setup();
    render(sized(<Viewer ir={fixtureIr} />));
    const ep = await screen.findByText("GET /users");
    expect(screen.queryByText("getUsers")).not.toBeInTheDocument();
    await user.click(ep);
    expect(await screen.findByText("getUsers")).toBeInTheDocument();
  });

  it("hides the handler again when the entrypoint is clicked twice", async () => {
    const user = userEvent.setup();
    render(sized(<Viewer ir={fixtureIr} />));
    const ep = await screen.findByText("GET /users");
    await user.click(ep);
    expect(await screen.findByText("getUsers")).toBeInTheDocument();
    await user.click(ep);
    expect(screen.queryByText("getUsers")).not.toBeInTheDocument();
  });
});
