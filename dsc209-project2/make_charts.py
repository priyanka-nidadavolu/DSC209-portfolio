"""DSC 209R Project 2 - final charts.
Data: World Bank WDI life expectancy at birth (SP.DYN.LE00.IN), course repo
ZeningQu/World-Bank-Data-by-Indicators (health-raw-2021.csv, WDI 2021-09-15).
"""
import sys
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.ticker import MultipleLocator

RAW = "data/wbrepo/health/health-raw-2021.csv"
META = "data/wbrepo/health/Metadata_Country_API_8_DS2_en_csv_v2_3052924.csv"
OUT = sys.argv[1] if len(sys.argv) > 1 else "out"

raw = pd.read_csv(RAW, skiprows=4)
meta = pd.read_csv(META)[["Country Code", "Region", "IncomeGroup"]]

def long(code):
    d = raw[raw["Indicator Code"] == code]
    d = d.drop(columns=[c for c in d.columns if c.startswith("Unnamed")] + ["Indicator Name", "Indicator Code"])
    d = d.melt(id_vars=["Country Name", "Country Code"], var_name="year", value_name="v")
    d["year"] = d.year.astype(int)
    return d.pivot_table(index="Country Code", columns="year", values="v")

le = long("SP.DYN.LE00.IN")
pop = long("SP.POP.TOTL")
names = raw.drop_duplicates("Country Code").set_index("Country Code")["Country Name"]
countries = meta[meta.Region.notna()].set_index("Country Code")  # drops aggregates

# ---------- style ----------
INK, INK2, MUTED, GRID = "#1d1d1b", "#52514e", "#8a8984", "#e6e5e0"
BLUE, TEAL = "#2a78d6", "#1baf7a"
REDS = ["#7f1d1d", "#b42318", "#d9462c", "#e8743b", "#a3361f"]
plt.rcParams.update({
    "font.family": "Inter", "font.size": 10, "axes.edgecolor": MUTED,
    "axes.labelcolor": INK2, "xtick.color": INK2, "ytick.color": INK2,
    "axes.spines.top": False, "axes.spines.right": False,
    "axes.grid": True, "grid.color": GRID, "grid.linewidth": 0.8,
    "axes.axisbelow": True, "figure.dpi": 100, "savefig.dpi": 220,
})

def header(fig, title, sub):
    h = fig.get_figheight()
    fig.text(0.035, 1 - 0.16 / h, title, fontsize=14, fontweight="semibold", color=INK, va="top")
    fig.text(0.035, 1 - 0.53 / h, sub, fontsize=9.5, color=INK2, va="top")

def source(fig, text):
    fig.text(0.035, 0.11 / fig.get_figheight(), text, fontsize=7.5, color=MUTED)

yrs = list(range(1960, 2020))
hic, lic = le.loc["HIC", yrs], le.loc["LIC", yrs]

# =====================================================================
# SIDE 1A  income-group gap
# =====================================================================
fig, (ax, axg) = plt.subplots(2, 1, figsize=(7.2, 6.4), sharex=True, gridspec_kw=dict(height_ratios=[3, 1.25], hspace=0.12))
fig.subplots_adjust(left=0.09, right=0.84, top=0.84, bottom=0.1)
ax.fill_between(yrs, lic, hic, color=BLUE, alpha=0.10, lw=0)
ax.plot(yrs, hic, color=BLUE, lw=2.2)
ax.plot(yrs, lic, color=TEAL, lw=2.2)
ax.set_xlim(1960, 2019); ax.set_ylim(35, 85)
ax.yaxis.set_major_locator(MultipleLocator(10))
ax.set_ylabel("Life expectancy at birth (years)")
for y, s_, c in [(hic.iloc[-1], "High-income\ncountries", BLUE), (lic.iloc[-1], "Low-income\ncountries", TEAL)]:
    ax.annotate(s_, (2019, y), xytext=(8, 0), textcoords="offset points", va="center", color=c, fontsize=9.5, fontweight="medium", annotation_clip=False)
g60, g19 = hic.iloc[0] - lic.iloc[0], hic.iloc[-1] - lic.iloc[-1]
ax.text(1990, 79.2, f"+{hic.iloc[-1]-hic.iloc[0]:.0f} years since 1960", color=BLUE, fontsize=9)
# human-terms callout on the low-income line
ax.scatter([1960, 2019], [lic.iloc[0], lic.iloc[-1]], s=36, color=TEAL, zorder=4, edgecolor="white", linewidth=1, clip_on=False)
ax.annotate(f"A child born in a low-income country\nin 2019 can expect to live {lic.iloc[-1]-lic.iloc[0]:.0f} years\nlonger than one born there in 1960",
            (2003, lic.loc[2003]), xytext=(1981, 39.5), fontsize=9, color=INK, va="bottom",
            arrowprops=dict(arrowstyle="-", color=MUTED, lw=0.8, connectionstyle="arc3,rad=-0.2"))
ax.text(1961, lic.iloc[0] - 3.2, f"{lic.iloc[0]:.0f}", color=TEAL, fontsize=9, fontweight="medium")
# gap panel
gap = hic - lic
axg.fill_between(yrs, gap, 15, color=INK2, alpha=0.07, lw=0)
axg.plot(yrs, gap, color=INK2, lw=2)
axg.scatter([1960, 2019], [gap.iloc[0], gap.iloc[-1]], s=30, color=INK2, zorder=4, edgecolor="white", linewidth=1, clip_on=False)
axg.set_ylim(15, 33); axg.yaxis.set_major_locator(MultipleLocator(5))
axg.set_ylabel("Gap (years)")
axg.annotate(f"{g60:.0f} years", (1960, gap.iloc[0]), xytext=(10, 4), textcoords="offset points", fontsize=9, color=INK, fontweight="medium", va="bottom")
axg.annotate(f"{g19:.0f} years", (2019, gap.iloc[-1]), xytext=(8, 0), textcoords="offset points", fontsize=9, color=INK, fontweight="medium", va="center", annotation_clip=False)
axg.text(1985, 27.2, f"Gap between the two groups narrowed by {g60-g19:.0f} years", fontsize=8.5, color=INK2)
header(fig, "The gap is closing", f"Life expectancy in low-income countries rose twice as fast as in high-income countries,\nshrinking the gap by {g60-g19:.0f} years between 1960 and 2019.")
source(fig, "Source: World Bank, World Development Indicators (SP.DYN.LE00.IN). World Bank income-group aggregates.")
fig.savefig(f"{OUT}/side1_gap.png"); plt.close(fig)

# =====================================================================
# SIDE 1B  beta-convergence scatter: start level vs gain
# =====================================================================
d = pd.DataFrame({"start": le[1960], "end": le[2019], "pop": pop[2019]}).loc[lambda x: x.index.isin(countries.index)].dropna()
d["gain"] = d.end - d.start
r = np.corrcoef(d.start, d.gain)[0, 1]
b, a = np.polyfit(d.start, d.gain, 1)
fig, ax = plt.subplots(figsize=(7.2, 4.6))
fig.subplots_adjust(left=0.09, right=0.95, top=0.78, bottom=0.16)
size = np.sqrt(d["pop"] / 1e6) * 9 + 6
ax.scatter(d.start, d.gain, s=size, color=TEAL, alpha=0.45, edgecolor="white", linewidth=0.8)
xs = np.array([28, 75])
ax.plot(xs, a + b * xs, color=INK2, lw=1.2, ls=(0, (4, 3)))
ax.set_xlim(28, 75); ax.set_ylim(0, 45)
ax.set_xlabel("Life expectancy in 1960 (years)")
ax.set_ylabel("Years gained, 1960 to 2019")
lab = {"CHN": (6, 8), "IND": (10, -2), "KOR": (8, 4), "BGD": (-10, 10), "ETH": (-8, -16), "USA": (-6, -14), "GBR": (-8, 12), "NOR": (-4, -16)}
for iso, off in lab.items():
    x, y = d.loc[iso, "start"], d.loc[iso, "gain"]
    ax.annotate({"KOR": "South Korea"}.get(iso, names[iso]), (x, y), xytext=off, textcoords="offset points", fontsize=8.5, color=INK, ha="left" if off[0] >= 0 else "right")
ax.text(74, 41.5, f"{len(d)} countries, correlation r = {r:.2f}\nBubble size = population (2019)", ha="right", fontsize=8.5, color=INK2)
header(fig, "The further behind a country started, the more it gained", "Countries with the shortest lives in 1960 added the most years by 2019.\nEach bubble is one country; the dashed line is the linear trend.")
source(fig, "Source: World Bank, World Development Indicators (SP.DYN.LE00.IN, SP.POP.TOTL). Countries with data in both 1960 and 2019.")
fig.savefig(f"{OUT}/side1_scatter.png"); plt.close(fig)

# =====================================================================
# SIDE 2A  low-income countries 2019 vs rich world 1960
# =====================================================================
licc = countries[countries.IncomeGroup == "Low income"].index
s = le.loc[le.index.isin(licc), 2019].dropna().sort_values()
h60, h19 = le.loc["HIC", 1960], le.loc["HIC", 2019]
below = (s < h60).sum()
s60 = le.loc[s.index, 1960]
fig, ax = plt.subplots(figsize=(7.2, 7.4))
fig.subplots_adjust(left=0.27, right=0.95, top=0.85, bottom=0.12)
yy = np.arange(len(s))
col = np.where(s.values < h60, REDS[1], MUTED)
ax.hlines(yy, 50, s.values, color=GRID, lw=1.2)
ax.scatter(s.values, yy, s=44, color=col, zorder=3, edgecolor="white", linewidth=0.8)
# rich-world reference row
ry = len(s) + 0.9
ax.annotate("", (h19, ry), (h60, ry), arrowprops=dict(arrowstyle="-|>", color=BLUE, lw=1.6, shrinkA=0, shrinkB=3, mutation_scale=10))
ax.scatter([h60], [ry], s=14, color=BLUE, zorder=3); ax.scatter([h19], [ry], s=48, color=BLUE, zorder=3, edgecolor="white", linewidth=0.8)
labels = [names[i].replace("Korea, Dem. People's Rep.", "North Korea").replace("Congo, Dem. Rep.", "DR Congo").replace("Yemen, Rep.", "Yemen").replace("Gambia, The", "The Gambia").replace("Syrian Arab Republic", "Syria") for i in s.index]
ax.set_yticks(list(yy) + [ry], labels + ["High-income average"], fontsize=8.5)
ax.get_yticklabels()[-1].set_color(BLUE); ax.get_yticklabels()[-1].set_fontweight("semibold")
ax.grid(axis="y", visible=False)
ax.set_xlim(50, 85); ax.set_ylim(-1, ry + 0.9)
ax.set_xlabel("Life expectancy at birth, 2019 (years)")
ax.axvline(h60, color=BLUE, lw=1.1, ls=(0, (4, 3)), zorder=1)
ax.text(h60 + 0.6, 0.2, f"Where rich countries\nstood in 1960: {h60:.1f}", color=BLUE, fontsize=8.5, va="bottom")
ax.text(h60 - 0.5, ry, "1960", fontsize=8, color=BLUE, ha="right", va="center")
ax.text(h19, ry + 0.35, "2019", fontsize=8, color=BLUE, ha="center", va="bottom")
ax.text(74.7, ry - 0.45, f"+{h19-h60:.1f} years", fontsize=8, color=BLUE, ha="center", va="top")
header(fig, f"{below} of {len(s)} low-income countries still trail the rich world of 1960",
       "Life expectancy in every low-income country in 2019. While the rich world moved on to 80.9,\nmost poor countries still haven't reached where it stood in 1960.")
source(fig, "Source: World Bank, World Development Indicators (SP.DYN.LE00.IN). \nLow-income = World Bank income classification. All 27 low-income countries with 2019 data shown.")
fig.savefig(f"{OUT}/side2_lowincome.png"); plt.close(fig)

# =====================================================================
# SIDE 2B  southern Africa reversal, 1985-2005
# =====================================================================
sa = ["SWZ", "LSO", "ZWE", "BWA", "ZAF"]
hiv = long("SH.DYN.AIDS.ZS")
yr2 = list(range(1985, 2006))
fig, (ax, axh) = plt.subplots(2, 1, figsize=(7.2, 6.6), sharex=True, gridspec_kw=dict(height_ratios=[2.6, 1.3], hspace=0.14))
fig.subplots_adjust(left=0.09, right=0.84, top=0.84, bottom=0.1)
def endlabels(axis, vals, gapmin, fmt=lambda n: n):
    order = sorted(vals, key=vals.get); pos, last = {}, -1e9
    for iso in order:
        p = max(vals[iso], last + gapmin); pos[iso] = p; last = p
    for iso, c in zip(sa, REDS):
        axis.annotate(fmt(names[iso]), (2005, vals[iso]), xytext=(2005.4, pos[iso]), textcoords="data", va="center", fontsize=9, color=c, annotation_clip=False)
ends = {}
for iso, c in zip(sa, REDS):
    ser = le.loc[iso, yr2]; ax.plot(yr2, ser, color=c, lw=2); ends[iso] = ser.iloc[-1]
endlabels(ax, ends, 1.6)
ax.set_ylim(40, 65); ax.yaxis.set_major_locator(MultipleLocator(5))
ax.set_ylabel("Life expectancy (years)")
swz = le.loc["SWZ"]
ax.scatter([1990, 2005], [swz[1990], swz[2005]], s=34, color=REDS[0], zorder=4, edgecolor="white", linewidth=1, clip_on=False)
ax.annotate(f"Eswatini peaked at {swz[1990]:.0f} in 1990", (1990, swz[1990]), xytext=(1990.6, 63.6), fontsize=8.8, color=INK, va="bottom")
ax.annotate(f"{swz[2005]:.0f} by 2005", (2005, swz[2005]), xytext=(-8, -2), textcoords="offset points", fontsize=8.8, color=INK, ha="right", va="top")
hv = {}
yh = list(range(1990, 2006))
for iso, c in zip(sa, REDS):
    ser = hiv.loc[iso, yh]; axh.plot(yh, ser, color=c, lw=1.8); hv[iso] = ser.iloc[-1]
axh.set_ylim(0, 30); axh.yaxis.set_major_locator(MultipleLocator(10))
axh.set_ylabel("HIV prevalence\n(% ages 15-49)")
axh.text(1985.4, 27, "Share of adults living\nwith HIV (same colors\nas above)", fontsize=8.5, color=INK2, va="top")
axh.text(1985.4, 3.5, "data begins 1990", fontsize=7.5, color=MUTED)
axh.set_xlim(1985, 2005); axh.xaxis.set_major_locator(MultipleLocator(5))
drop = (le.loc[sa, yr2].max(axis=1) - le.loc[sa, 2005])
header(fig, f"Southern Africa lost up to {drop.max():.0f} years of life expectancy in 15 years",
       "As HIV spread to a fifth or more of adults, life expectancy collapsed across the region.\nBy 2005, Eswatini and Lesotho were back below their 1960 levels.")
source(fig, "Source: World Bank, World Development Indicators (SP.DYN.LE00.IN, SH.DYN.AIDS.ZS), 1985 to 2005.")
fig.savefig(f"{OUT}/side2_southern_africa.png"); plt.close(fig)

# numbers used in the write-up
print(dict(gap60=round(g60, 1), gap19=round(g19, 1), lic_gain=round(lic.iloc[-1]-lic.iloc[0], 1),
           hic_gain=round(hic.iloc[-1]-hic.iloc[0], 1), r=round(r, 2), slope=round(b, 2), n=len(d),
           below=int(below), nlic=len(s), h60=round(h60, 1), drops=drop.round(1).to_dict(),
           swz60=le.loc["SWZ", 1960], lso60=le.loc["LSO", 1960], bwa19=le.loc["BWA", 2019],
           gap80=round(le.loc["HIC",1980]-le.loc["LIC",1980],1), gap00=round(le.loc["HIC",2000]-le.loc["LIC",2000],1)))
