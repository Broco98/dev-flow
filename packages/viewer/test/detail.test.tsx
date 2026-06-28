import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { Viewer } from "../src/Viewer";
import { useGraphUi } from "../src/state/uiStore";
import fixtureIr from "./fixtures/express-app.ir.json";

const sized = (ui: ReactNode) => <div style={{ width: 800, height: 600 }}>{ui}</div>;

beforeEach(() => useGraphUi.setState({ selectedId: null, expanded: new Set<string>() }));

describe("detail panel + model reveal", () => {
  it("shows the selected entrypoint's file:line in the detail panel", async () => {
    const user = userEvent.setup();
    render(sized(<Viewer ir={fixtureIr} />));
    await user.click(await screen.findByText("GET /users"));
    expect(await screen.findByTestId("detail-loc")).toHaveTextContent("src/app.ts:5");
    expect(screen.getByTestId("detail-kind")).toHaveTextContent("entrypoint");
  });

  it("shows a function's signature when selected, and reveals a touched model", async () => {
    const user = userEvent.setup();
    render(sized(<Viewer ir={fixtureIr} />));
    await user.click(await screen.findByText("GET /users")); // expand -> getUsers
    await user.click(await screen.findByText("getUsers")); // select + expand -> listUsers
    expect(await screen.findByTestId("detail-sig")).toHaveTextContent("_req: Request");
    await user.click(await screen.findByText("listUsers")); // expand -> User model (dataTouch)
    expect(await screen.findByText("User")).toBeInTheDocument();
  });
});
