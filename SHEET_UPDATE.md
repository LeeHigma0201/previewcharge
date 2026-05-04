# HorseGPT — CD 2026-05-02 Derby Day — Sheet Update

Sheet: https://docs.google.com/spreadsheets/d/1sjDEqTjwFtXa4MMTyKSNiIzw3hjYrxefwYJlGJDyzJ0/edit?gid=129159174

API access blocked: gcloud ADC token only carries `cloud-platform` scope, not `spreadsheets`. To unlock for next time, run interactively:

```
gcloud auth application-default login --scopes=openid,https://www.googleapis.com/auth/userinfo.email,https://www.googleapis.com/auth/cloud-platform,https://www.googleapis.com/auth/spreadsheets,https://www.googleapis.com/auth/drive
```

Until then, paste the blocks below.

---

## RESULTS tab — paste starting at A1 (or A2 if header already present)

Headers (row 1 — skip if already there):

```
Race	Algo Top 5	Actual Finish	Algo P1 Right?	Top 5 Capture %	EX Payout/$1	TR Payout/$0.50	SUPER Payout/$1	HI5 Payout/$1	Notes
```

Data rows (TSV — copy entire block, paste into A2; Sheets will split on tabs):

```
1	11,3,9,?,?	11-3-4-6-2	YES	2/3	n/a	n/a	n/a	n/a	TR LOST $3
2	8,4,1,?,?	1-2-9-8-6	NO	1/3	n/a	n/a	n/a	$15,408	SKIP - massive miss
3	12,6,10,?,?	10-14-6-12	NO	2/3	n/a	n/a	n/a	n/a	SKIP - trainer signal
4	4,5,1,?,?	6-4-1	NO	2/3	n/a	n/a	n/a	n/a	TR LOST $3
5	3,9,7,10,5	7-10-9-3-5	NO	5/5	n/a	n/a	n/a	$139.82	TR LOST - missed Hi5 BOX +$128 retro
6	2,4,6,7,11	6-11-2-7-4	NO	5/5	n/a	n/a	n/a	n/a	TAMARA WON $39.08 (Tri Key Box)
7	2,3,8,5,4	5-3-8-7-6	NO	4/5	$25.59	$53.03	$452.02	$10,975	LOST $21 - 4-AI swap killed it
8	1,6,2,7,8	6-1-5-2	NO	3/4	$5.40	$37.82	$114.30	$506	SKIP CORRECT - chalk EX
9	4,12,?,?,?	4-12-9-7-3	YES	2/3	$7.79	$67.46	$331.72	$5,617	SKIP CORRECT - longshot 3rd
10	6,2,?,?,?	8-5-9-7-2	NO	1/3	$54.22	$901.38	$5,766	$53,811	SKIP CORRECT - total miss, longshot won
11	6,4,?,?,?	6-10-1-4-5	YES	2/3	$27.90	$263.12	$1,255	$9,295	SKIP - PARTIAL_EDGE missed
```

Quick rollup (eyeball row): Algo P1 right 3/11 (R1, R9, R11). 27%. Top-5 capture floor 1/3, peak 5/5.

---

## BETS tab — paste at top (or under existing rows)

Headers:

```
Bettor	Race	Bet Type	Selection	Stake	Combos	Notes
```

### JASON — R12 (Derby) — $19.50 total

```
Jason	12	WIN	#12 Chief Wallabee	$5.00	1	Top algo pick
Jason	12	TR	#12 / #1,#6,#18 / #1,#6,#18,#15,#7,#8	$7.50	15	$0.50 base · A/B/C structure
Jason	12	EX BOX	#12, #15	$2.00	2	$1 box
Jason	12	EX BOX	#6, #18	$2.00	2	$1 box
Jason	12	WIN	#15 Emerging Market	$1.00	1	Saver
Jason	12	PLACE	#15 Emerging Market	$2.00	1	Place safety
Jason	TOTAL	—	—	$19.50	—	—
```

### TAMARA — R12 (Derby) — $20.00 total

```
Tamara	12	TR KEY BOX	#12 / #6, #15, #18	$9.00	18	$0.50 base · key box
Tamara	12	TR	#6, #18 / #6, #18 / #1, #12, #15, #7, #8	$5.00	10	$0.50 base · part-wheel
Tamara	12	PLACE	#12 Chief Wallabee	$2.00	1	—
Tamara	12	PLACE	#15 Emerging Market	$2.00	1	—
Tamara	12	EX	#12 / #15	$1.00	1	Straight
Tamara	12	EX	#15 / #12	$1.00	1	Reverse
Tamara	TOTAL	—	—	$20.00	—	—
```

Combined household stake: $39.50. Both books cover the #12 / #15 / #6 / #18 spine.
