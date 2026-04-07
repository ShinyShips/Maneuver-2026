import json
import statistics

with open(r"experiment-export-2026-04-05 (1).json", "r") as f:
    data = json.load(f)

print("="*60)
print("EXPERIMENT DATA ANALYSIS")
print("="*60)

# Sessions
sessions = data["sessions"]
print(f"\nTotal participants: {len(sessions)}")
for s in sessions:
    print(f"  {s['participantCode']} - Group {s['group']} - Order: {s['interfaceOrder']}")

group_a = [s for s in sessions if s['group'] == 'A']
group_b = [s for s in sessions if s['group'] == 'B']
print(f"\nGroup A (visual first): {len(group_a)}")
print(f"Group B (form first): {len(group_b)}")

# Responses
responses = data["responses"]
print(f"\nTotal responses: {len(responses)}")

visual_responses = [r for r in responses if r['interfaceType'] == 'visual']
form_responses = [r for r in responses if r['interfaceType'] == 'form']

print(f"Visual interface responses: {len(visual_responses)}")
print(f"Form interface responses: {len(form_responses)}")

# Duration analysis
print("\n" + "="*60)
print("TASK COMPLETION TIME (ms)")
print("="*60)

visual_durations = [r['durationMs'] for r in visual_responses]
form_durations = [r['durationMs'] for r in form_responses]

# Filter out the 3729ms outlier (P-NIAHA visual clip-2 - basically empty submission)
visual_durations_filtered = [d for d in visual_durations if d > 60000]
print(f"\nVisual durations (all): {visual_durations}")
print(f"Visual durations (filtered, >60s): {visual_durations_filtered}")
print(f"Form durations: {form_durations}")

print(f"\nVisual Mean: {statistics.mean(visual_durations_filtered):.0f} ms ({statistics.mean(visual_durations_filtered)/1000:.1f} s)")
print(f"Visual SD: {statistics.stdev(visual_durations_filtered):.0f} ms")
print(f"Form Mean: {statistics.mean(form_durations):.0f} ms ({statistics.mean(form_durations)/1000:.1f} s)")
print(f"Form SD: {statistics.stdev(form_durations):.0f} ms")

# NASA-TLX analysis
print("\n" + "="*60)
print("NASA-TLX SCORES")
print("="*60)

tlx_dims = ['mentalDemand', 'physicalDemand', 'temporalDemand', 'performance', 'effort', 'frustration']

# Filter out the empty visual response (3729ms duration)
visual_responses_valid = [r for r in visual_responses if r['durationMs'] > 60000]

for dim in tlx_dims:
    visual_scores = [r['tlxRaw'][dim] for r in visual_responses_valid]
    form_scores = [r['tlxRaw'][dim] for r in form_responses]
    print(f"\n{dim}:")
    print(f"  Visual: mean={statistics.mean(visual_scores):.2f}, sd={statistics.stdev(visual_scores):.2f}, values={visual_scores}")
    print(f"  Form:   mean={statistics.mean(form_scores):.2f}, sd={statistics.stdev(form_scores):.2f}, values={form_scores}")

# Overall TLX (raw average)
visual_overall = []
for r in visual_responses_valid:
    avg = statistics.mean([r['tlxRaw'][d] for d in tlx_dims])
    visual_overall.append(avg)

form_overall = []
for r in form_responses:
    avg = statistics.mean([r['tlxRaw'][d] for d in tlx_dims])
    form_overall.append(avg)

print(f"\nOverall TLX (raw mean of dimensions):")
print(f"  Visual: mean={statistics.mean(visual_overall):.2f}, sd={statistics.stdev(visual_overall):.2f}")
print(f"  Form:   mean={statistics.mean(form_overall):.2f}, sd={statistics.stdev(form_overall):.2f}")

# Preferences
print("\n" + "="*60)
print("PREFERENCES")
print("="*60)

preferences = data["preferences"]
pref_counts = {}
for p in preferences:
    pi = p['preferredInterface']
    pref_counts[pi] = pref_counts.get(pi, 0) + 1
print(f"\nPreferred interface: {pref_counts}")

visual_satisfaction = [p['visualSatisfaction'] for p in preferences]
form_satisfaction = [p['formSatisfaction'] for p in preferences]
visual_ease = [p['visualEase'] for p in preferences]
form_ease = [p['formEase'] for p in preferences]

print(f"\nVisual Satisfaction: mean={statistics.mean(visual_satisfaction):.2f}, values={visual_satisfaction}")
print(f"Form Satisfaction:   mean={statistics.mean(form_satisfaction):.2f}, values={form_satisfaction}")
print(f"Visual Ease:         mean={statistics.mean(visual_ease):.2f}, values={visual_ease}")
print(f"Form Ease:           mean={statistics.mean(form_ease):.2f}, values={form_ease}")

# Accuracy / Comparisons
print("\n" + "="*60)
print("ACCURACY COMPARISONS")
print("="*60)

comparisons = data["comparisons"]
print(f"\nTotal comparisons: {len(comparisons)}")

# Map response IDs to interface types
response_map = {r['id']: r for r in responses}

visual_comparisons = [c for c in comparisons if c['interfaceType'] == 'visual']
form_comparisons = [c for c in comparisons if c['interfaceType'] == 'form']

# Filter out the empty visual submission
visual_comparisons_valid = [c for c in visual_comparisons if response_map[c['responseId']]['durationMs'] > 60000]

print(f"\nVisual comparisons (valid): {len(visual_comparisons_valid)}")
print(f"Form comparisons: {len(form_comparisons)}")

visual_accuracy = [c['accuracyPercent'] for c in visual_comparisons_valid]
form_accuracy = [c['accuracyPercent'] for c in form_comparisons]
visual_error = [c['normalizedError'] for c in visual_comparisons_valid]
form_error = [c['normalizedError'] for c in form_comparisons]

print(f"\nVisual Accuracy: mean={statistics.mean(visual_accuracy):.2f}%, sd={statistics.stdev(visual_accuracy):.2f}")
print(f"Form Accuracy:   mean={statistics.mean(form_accuracy):.2f}%, sd={statistics.stdev(form_accuracy):.2f}")
print(f"\nVisual Norm Error: mean={statistics.mean(visual_error):.4f}, sd={statistics.stdev(visual_error):.4f}")
print(f"Form Norm Error:   mean={statistics.mean(form_error):.4f}, sd={statistics.stdev(form_error):.4f}")

print(f"\nVisual accuracy values: {[f'{a:.1f}%' for a in visual_accuracy]}")
print(f"Form accuracy values: {[f'{a:.1f}%' for a in form_accuracy]}")

# Fuel scored analysis
print("\n" + "="*60)
print("FUEL SCORED (Total = auto + teleop)")
print("="*60)

for label, resps in [("Visual (valid)", visual_responses_valid), ("Form", form_responses)]:
    total_fuels = [r['metrics']['auto']['fuelScored'] + r['metrics']['teleop']['fuelScored'] for r in resps]
    print(f"\n{label}: mean={statistics.mean(total_fuels):.1f}, values={total_fuels}")

# Answer key fuel totals
print("\nAnswer keys:")
for ak in data['answerKeys']:
    total = ak['metrics']['auto']['fuelScored'] + ak['metrics']['teleop']['fuelScored']
    print(f"  {ak['clipId']}: auto={ak['metrics']['auto']['fuelScored']}, teleop={ak['metrics']['teleop']['fuelScored']}, total={total}")

# Per-participant paired analysis
print("\n" + "="*60)
print("PAIRED PARTICIPANT ANALYSIS")
print("="*60)

for s in sessions:
    sid = s['id']
    s_responses = [r for r in responses if r['sessionId'] == sid]
    s_comps = [c for c in comparisons if c['sessionId'] == sid]
    print(f"\n{s['participantCode']} (Group {s['group']}, order={s['interfaceOrder']}):")
    for r in sorted(s_responses, key=lambda x: x['block']):
        comp = next((c for c in s_comps if c['responseId'] == r['id']), None)
        acc = f"{comp['accuracyPercent']:.1f}%" if comp else "N/A"
        tlx_avg = statistics.mean([r['tlxRaw'][d] for d in tlx_dims])
        print(f"  Block {r['block']}: {r['interfaceType']:6s} | clip={r['clipId']} | duration={r['durationMs']/1000:.0f}s | accuracy={acc} | TLX_avg={tlx_avg:.1f}")

print("\n" + "="*60)
print("NOTES FROM PREFERENCES")
print("="*60)
for p in preferences:
    if 'notes' in p and p['notes']:
        sid = p['sessionId']
        s = next(s2 for s2 in sessions if s2['id'] == sid)
        print(f"\n{s['participantCode']}: \"{p['notes']}\"")
