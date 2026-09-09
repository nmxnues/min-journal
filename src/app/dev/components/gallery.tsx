"use client";

import { useState } from "react";
import { BarChart3, CalendarDays, LineChart, NotebookPen, Wallet } from "lucide-react";
import { BalanceAndRValueChart } from "@/components/charts/balance-r-value-chart";
import { EquityCurve, Sparkline } from "@/components/charts/equity-curve";
import { BottomTabBar } from "@/components/nav/bottom-tab-bar";
import { TopBar } from "@/components/nav/top-bar";
import { RangeDiagram } from "@/components/range-diagram";
import {
  BarRow,
  Button,
  Card,
  CardHeader,
  CardTitle,
  Chip,
  Combobox,
  Dropzone,
  EmptyState,
  Field,
  Input,
  Modal,
  Panel,
  Segmented,
  Select,
  StatCard,
  Textarea,
  ToggleChip,
} from "@/components/ui";

const NAV = [
  { href: "/", label: "Dashboard" },
  { href: "/trades", label: "Trades" },
  { href: "/calendar", label: "Calendar" },
  { href: "/playbook", label: "Playbook" },
  { href: "/capital", label: "Capital" },
];

const TABS = [
  { href: "/", label: "홈", icon: BarChart3 },
  { href: "/trades", label: "기록", icon: NotebookPen },
  { href: "/calendar", label: "캘린더", icon: CalendarDays },
  { href: "/playbook", label: "플레이북", icon: LineChart },
  { href: "/capital", label: "자산", icon: Wallet },
];

const INSTRUMENTS = ["EURUSD", "GBPUSD", "USDJPY", "AUDUSD", "EURJPY", "GBPJPY", "XAUUSD"];

/** Mock 1a's equity curve, as cumulative R. */
const EQUITY = [0, 1.2, 0.7, 3.4, 2.7, 5.2, 4.5, 7.0, 5.8, 7.9, 7.3, 9.7, 8.4, 10.3, 9.6, 11.7, 10.8, 12.6, 13.4];

const CAPITAL_POINTS = [
  { balance: 15_000, rValue: 150 },
  { balance: 15_400, rValue: 154 },
  { balance: 16_200, rValue: 162 },
  { balance: 17_000, rValue: 170 },
  { balance: 18_600, rValue: 186 },
  { balance: 18_300, rValue: 183 },
  { balance: 21_400, rValue: 214, isCashEvent: true },
  { balance: 22_100, rValue: 221 },
  { balance: 21_700, rValue: 217 },
  { balance: 23_900, rValue: 239 },
  { balance: 23_200, rValue: 232 },
  { balance: 26_440, rValue: 264, isCashEvent: true },
  { balance: 27_600, rValue: 276 },
  { balance: 30_100, rValue: 301 },
  { balance: 32_180, rValue: 322 },
];

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <Card className="p-32">
      <CardTitle>{title}</CardTitle>
      {note !== undefined && <p className="mt-6 text-12_5 font-medium text-faint">{note}</p>}
      <div className="mt-20">{children}</div>
    </Card>
  );
}

export function ComponentGallery() {
  const [session, setSession] = useState<string | null>("ny_am");
  const [result, setResult] = useState<string | null>("win");
  const [sweep, setSweep] = useState<string | null>("low");
  const [instrument, setInstrument] = useState("EURUSD");
  const [tags, setTags] = useState<string[]>(["On plan"]);
  const [modalOpen, setModalOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [dropped, setDropped] = useState<string[]>([]);

  const toggleTag = (tag: string) =>
    setTags((current) => (current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag]));

  return (
    <main className="min-h-full bg-page pb-40">
      <TopBar
        items={NAV}
        activeHref="/"
        right={
          <>
            <span className="text-13 font-semibold text-muted">September 2026</span>
            <Button>New trade</Button>
          </>
        }
      />

      <div className="mx-auto flex max-w-[1000px] flex-col gap-16 p-32">
        <header>
          <h1 className="text-24 font-extrabold tracking-[-.03em] text-ink">Components</h1>
          <p className="mt-6 text-13_5 text-secondary">
            Dev-only route. Every primitive at the sizes the mocks actually use, for eyeballing
            against <code className="text-12_5">docs/design-canvas.html</code>.
          </p>
        </header>

        <Section title="Button">
          <div className="flex flex-wrap items-center gap-12">
            <Button>New trade</Button>
            <Button tone="neutral">Save draft</Button>
            <Button tone="subtle" size="sm">Choose file</Button>
            <Button tone="ink" size="sm">Month</Button>
            <Button tone="link">View all 61</Button>
            <Button disabled>Disabled</Button>
          </div>
          <div className="mt-16 flex gap-12">
            <Button tone="neutral" size="lg" className="flex-1">Save draft</Button>
            <Button size="lg" className="flex-2">Log trade</Button>
          </div>
          <div className="mt-16">
            <Button size="xl" className="w-full">기록하기</Button>
          </div>
        </Section>

        <Section title="Field / Input / Select / Combobox">
          <div className="grid grid-cols-2 gap-16">
            <Field label="Instrument" htmlFor="instrument">
              <Combobox
                id="instrument"
                value={instrument}
                onChange={setInstrument}
                options={INSTRUMENTS}
                placeholder="EURUSD"
              />
            </Field>
            <Field label="Date" htmlFor="date">
              <Input id="date" type="date" defaultValue="2026-09-09" />
            </Field>
            <Field label="HTF pairing" htmlFor="htf">
              <Select id="htf" defaultValue="w_2d">
                <option value="m_w_2d">M → W → 2D</option>
                <option value="w_2d">W → 2D</option>
                <option value="d_h1">D → H1</option>
                <option value="h1_m5">H1 → M5</option>
              </Select>
            </Field>
            <Field label="Entry" htmlFor="entry" error="Stop must differ from entry.">
              <Input id="entry" inputMode="decimal" defaultValue="23,411.00" />
            </Field>
          </div>
        </Section>

        <Section title="Segmented" note="Result's selected Win state uses the gain colour, not the accent.">
          <div className="flex flex-col gap-16">
            <Segmented
              name="Session"
              value={session}
              onChange={setSession}
              options={[
                { value: "asia", label: "Asia" },
                { value: "london", label: "London" },
                { value: "ny_am", label: "NY AM" },
              ]}
            />
            <Segmented
              name="Result"
              value={result}
              onChange={setResult}
              options={[
                { value: "win", label: "Win", tone: "gain" },
                { value: "loss", label: "Loss", tone: "loss" },
                { value: "be", label: "Break-even" },
              ]}
            />
            <Segmented
              name="Sweep"
              value={sweep}
              onChange={setSweep}
              showCheck
              options={[
                { value: "low", label: "저점 퍼지 · 롱 방향" },
                { value: "high", label: "고점 퍼지 · 숏 방향" },
              ]}
            />
          </div>
        </Section>

        <Section title="Chip / Tag">
          <div className="flex flex-wrap items-center gap-8">
            <Chip>C2 expansion</Chip>
            <Chip tone="accent">Off-plan</Chip>
            <Chip tone="muted">Retired</Chip>
            <Chip shape="stat">61 trades</Chip>
            <Chip shape="stat" tone="gain">+$9,680 trading</Chip>
          </div>
          <div className="mt-16 flex flex-wrap items-center gap-8">
            <Chip shape="pill">H4 → M15</Chip>
            <Chip shape="pill">Low purged</Chip>
            <Chip shape="pill" tone="accent">On plan</Chip>
          </div>
          <div className="mt-16 flex flex-wrap items-center gap-8">
            {["On plan", "Impatient", "Chased entry", "Early exit"].map((tag) => (
              <ToggleChip key={tag} selected={tags.includes(tag)} onToggle={() => toggleTag(tag)}>
                {tag}
              </ToggleChip>
            ))}
          </div>
        </Section>

        <Section title="StatCard">
          <div className="grid grid-cols-4 gap-16">
            <StatCard label="Avg win" value="2.3R" />
            <StatCard label="Avg loss" value="−0.9R" />
            <StatCard label="Win streak" value="4 trades" />
            <StatCard label="Rule adherence" value="87%" />
          </div>
          <div className="mt-16 grid grid-cols-4 gap-16">
            <StatCard label="Net" value="+7.2R" tone="gain" sub="9 trades" size="md" />
            <StatCard label="Win rate" value="67%" sub="6 / 9" size="md" />
            <StatCard label="Rule adherence" value="89%" sub="1 off-plan" size="md" />
            <StatCard label="Trading P&L" value="+$9,680" tone="gain" sub="+43.0R lifetime" size="md" />
          </div>
        </Section>

        <Section title="BarRow">
          <div className="flex flex-col gap-18">
            <BarRow label="C2 sweep → expansion" value={<span className="text-gain">+11.2R</span>} share={1} tone="gain" caption="24 trades · 62% win rate" />
            <BarRow label="C3 continuation" value={<span className="text-gain">+6.8R</span>} share={0.61} tone="gain" caption="18 trades · 55% win rate" />
            <BarRow label="Mid-range entry" value={<span className="text-loss">−2.7R</span>} share={0.24} tone="loss" caption="8 trades · 25% win rate · off-plan entries" />
          </div>
          <div className="mt-24 flex flex-col gap-14 border-t border-divider pt-24">
            <BarRow label="Low purged" value="62%" share={0.62} tone="ink" height={7} />
            <BarRow label="Both swept" value="31%" share={0.31} tone="weak" height={7} />
          </div>
        </Section>

        <Section title="Card / Panel / EmptyState">
          <div className="grid grid-cols-2 gap-16">
            <Card className="p-28">
              <CardHeader title="Recent trades" action={<Button tone="link">View all 61</Button>} />
              <div className="mt-16 grid grid-cols-4 gap-12">
                {["Entry", "Stop", "Exit", "Hold"].map((label, i) => (
                  <Panel key={label} className="px-18 py-16">
                    <div className="text-12 font-semibold text-muted">{label}</div>
                    <div className="mt-2 text-17 font-extrabold text-ink">
                      {["23,411.00", "23,396.50", "23,451.75", "38m"][i]}
                    </div>
                  </Panel>
                ))}
              </div>
            </Card>
            <EmptyState
              title="No trades yet"
              description="Log your first trade and the month's stats, calendar, and equity curve fill in from it."
              action={<Button>New trade</Button>}
            />
          </div>
        </Section>

        <Section title="Textarea / Dropzone">
          <div className="grid grid-cols-2 gap-16">
            <Dropzone
              title="Drag chart screenshots here"
              hint="Two shots recommended: HTF range + entry timeframe"
              buttonLabel="Choose file"
              onFiles={(files) => setDropped(files.map((f) => f.name))}
            />
            <Textarea placeholder="What did you see? What did you do?&#10;e.g. Waited for M1 displacement after the London low purge." />
          </div>
          {dropped.length > 0 && (
            <p className="mt-12 text-12_5 font-medium text-faint">Picked: {dropped.join(", ")}</p>
          )}
          <div className="mt-16 grid grid-cols-3 gap-16">
            <Textarea tone="review" placeholder="What worked" />
            <Textarea tone="review" placeholder="What didn't" />
            <Textarea tone="review" placeholder="One change" />
          </div>
        </Section>

        <Section title="Modal / Sheet">
          <div className="flex gap-12">
            <Button onClick={() => setModalOpen(true)}>Deposit / Withdraw</Button>
            <Button tone="neutral" onClick={() => setSheetOpen(true)}>Open sheet (mobile)</Button>
          </div>

          <Modal
            open={modalOpen}
            onClose={() => setModalOpen(false)}
            title="Record cash movement"
            footer={
              <div className="flex gap-12">
                <Button tone="neutral" size="lg" className="flex-1" onClick={() => setModalOpen(false)}>
                  Cancel
                </Button>
                <Button size="lg" className="flex-2" onClick={() => setModalOpen(false)}>
                  Record deposit
                </Button>
              </div>
            }
          >
            <div className="flex flex-col gap-16 pb-8">
              <Field label="Amount" htmlFor="amount">
                <Input id="amount" defaultValue="5,000" />
              </Field>
              <Panel className="rounded-16 px-20 py-18">
                <div className="flex justify-between text-13 font-semibold text-secondary">
                  <span>Balance after</span>
                  <span className="text-ink">$31,600</span>
                </div>
                <div className="mt-8 flex justify-between text-13 font-semibold text-secondary">
                  <span>1R moves to</span>
                  <span className="text-ink">
                    $316 <span className="font-medium text-faint">from $266</span>
                  </span>
                </div>
                <p className="mt-12 text-11_5 font-medium text-faint">
                  Only trades logged after this date use the new 1R.
                </p>
              </Panel>
            </div>
          </Modal>

          <Modal
            open={sheetOpen}
            onClose={() => setSheetOpen(false)}
            title="새 기록"
            variant="sheet"
            footer={
              <div className="flex gap-12">
                <Button tone="neutral" size="lg" className="flex-1" onClick={() => setSheetOpen(false)}>
                  이전
                </Button>
                <Button size="lg" className="flex-2" onClick={() => setSheetOpen(false)}>
                  다음
                </Button>
              </div>
            }
          >
            <p className="text-24 font-extrabold leading-[1.35] tracking-[-.03em] text-ink">
              레인지의 어느 쪽을 먼저 쓸었나요?
            </p>
            <p className="mt-8 text-13_5 font-medium text-muted">H4 레인지 23,402.75 — 23,486.25</p>
          </Modal>
        </Section>

        <Section title="EquityCurve" note="720×180 viewBox, 3px stroke, 16%→0 area fill, r=5 end dot.">
          <EquityCurve
            values={EQUITY}
            captions={{ start: "Aug 12", middle: "Max drawdown −3.2R", end: "Sep 9" }}
          />
        </Section>

        <Section title="Sparkline" note="300×70 viewBox, 3px stroke, no fill.">
          <div className="max-w-[320px]">
            <Sparkline values={EQUITY} />
          </div>
        </Section>

        <Section
          title="BalanceAndRValueChart"
          note="720×170, balance 3px ink with 10%→0 fill, 1R 2.5px accent on its own scale, r=4 dots on cash events."
        >
          <BalanceAndRValueChart
            points={CAPITAL_POINTS}
            legend={{ balance: "Balance", rValue: "1R value" }}
            captions={["Mar", "May · deposit", "Jul · withdrawal", "Sep"]}
          />
        </Section>

        <Section title="RangeDiagram" note="Layout, not a chart — built from divs.">
          <Panel className="rounded-20 px-28 pt-26 pb-20">
            <RangeDiagram
              rangeHigh={23_486.25}
              rangeLow={23_402.75}
              sweepSide="low"
              target={23_486.25}
              labels={{ sweep: "Sweep", target: "Target" }}
              captions={{ low: "Low 23,402.75", mid: "50% 23,444.50", high: "High 23,486.25" }}
            />
          </Panel>
          <Panel className="mt-16 rounded-20 px-28 pt-30 pb-22">
            <RangeDiagram
              variant="detail"
              rangeHigh={23_486.25}
              rangeLow={23_402.75}
              sweepSide="low"
              target={23_486.25}
              exit={23_451.75}
              labels={{ sweep: "Sweep", target: "Target", expansion: "Expansion · exit at 59%" }}
              captions={{ low: "Low 23,402.75", mid: "50% 23,444.50", high: "High 23,486.25" }}
            />
          </Panel>
        </Section>

        <Section title="BottomTabBar" note="No mock exists for this — designed from the TopBar's vocabulary.">
          <div className="mx-auto max-w-[375px] overflow-hidden rounded-24 border border-divider">
            <BottomTabBar items={TABS} activeHref="/" className="static" />
          </div>
        </Section>
      </div>
    </main>
  );
}
