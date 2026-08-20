(function (root) {
  "use strict";

  const TOPICS = {
    contact: "Contact means two PCWs touch each other, or a PCW touches another part. The grade depends on the contacted material, surface aggressiveness, movement and whether the routed feature is safety-related.",
    proximity: "Proximity means the parts are not continuously touching but are close enough to interact. In the VLO grading grid, the trigger used by this system is measured clearance below 3 mm.",
    heat: "Heat-source evaluation compares measured clearance with the official target for the PCW group, its position above or below the source, heatshield presence and safety classification. Thermal sleeve or tape can reduce the resulting severity according to the official grid.",
    aggressive: "An aggressive surface can damage the PCW, such as a sharp edge, screw tip, thread, burr, rough casting, welding point, unprotected cable control or an aggressive protector end. A friendly surface is generally smooth, rounded and has a broad bearing area.",
    safety: "Safety features include safety and braking functions, steering, fuel and regulation-related systems, battery/starter positive wiring and high-voltage PHEV/BEV cables. The inspector must confirm the classification using the controlled document.",
    movement: "High-speed rotation includes parts such as pulleys, belts, wheels, shafts, steering columns and fans. Relative motion occurs between different moving reference areas. Vibration occurs when both components share the same reference frame but still vibrate at the contact point.",
    protection: "A protection does not automatically make every contact acceptable. It must be approved and suitable for the movement and abrasion condition. The contact grid also contains specific no-grade cases for protected PCWs against friendly surfaces.",
    validated: "A condition already listed in the approved DQ or validated-contact reference is not counted as a new defect. The worker must verify the exact approved reference; the assistant cannot approve a new contact.",
    special: "Important contact exceptions include the below-8-mm vibration rule, protector-end exception, one-level increase for hard contact, one-level decrease for low-cycle friendly rubbing, and protected-PCW friendly-surface cases. The evaluator applies these after the initial grid grade."
  };

  function lines(items) {
    return items.map((item) => `- ${item}`).join("\n");
  }

  function assessmentReply(result) {
    if (!result) return "Complete the relevant fields, then ask me to evaluate the current condition.";
    return [
      `Based on the current entries, the initial grade is ${result.initialGrade} and the final grade is ${result.finalGrade} (${result.risk.label}).`,
      "",
      "Why:",
      lines(result.rules),
      "",
      "Suggested next action:",
      lines(result.actions),
      "",
      `Rule source: ${result.source}. Please confirm all measurements and classifications before saving.`
    ].join("\n");
  }

  function reply(question, context = {}) {
    const text = String(question || "").trim();
    const q = text.toLowerCase();
    if (!q) return "Ask a CCP question or select one of the suggested prompts.";

    const zoneMatch = q.match(/\bzone\s*([0-9]{1,2}[ab]?)\b/i);
    if (zoneMatch && context.findZone) {
      const zone = zoneMatch[1].toUpperCase();
      const info = context.findZone(zone);
      if (info) return `Zone ${zone} - ${info.title}. ${info.description}`;
      return `Zone ${zone} is not included in the inspection-zone list currently loaded in this evaluator.`;
    }

    if (/\b(hello|hi|hey|assalam|salam)\b/.test(q)) {
      return "Hello. I am the built-in CCP Assistant. I can explain the routing rules, review the current form and suggest the next action. What would you like to check?";
    }
    if (/\b(evaluate|assessment|assess|check my|current condition|current case|what grade|calculate)\b/.test(q)) {
      return assessmentReply(context.result || context.draftResult);
    }
    if (/\b(why|reason|explain).*(grade|result)|\bgrade.*(why|reason)\b/.test(q)) {
      const result = context.result || context.draftResult;
      return result ? `The grade comes from these steps:\n${lines(result.rules)}\n\nFinal grade: ${result.finalGrade} (${result.risk.label}).` : assessmentReply(null);
    }
    if (/\b(suggest|suggestion|recommend|action|fix|countermeasure|what should|next step)\b/.test(q)) {
      const result = context.result || context.draftResult;
      return result ? `For the current ${result.type.toLowerCase()} condition, I suggest:\n${lines(result.actions)}\n\nEngineering/CCP approval is still required.` : assessmentReply(null);
    }
    if (/\b(selected zone|current zone|where am i|location)\b/.test(q) && context.zone) {
      return `The selected location is Zone ${context.zone.id} - ${context.zone.title}. ${context.zone.description}`;
    }
    if (/\b(no grade|not graded)\b/.test(q)) {
      return "No grade means the condition does not require a defect grade under the applicable rule. It should still be recorded with evidence, and the worker must confirm that the exception or validated-contact reference truly applies.";
    }
    if (/\b(hard contact|concentrated load)\b/.test(q)) {
      return "Hard contact or concentrated load means a visible mark exists or the contacted parts cannot be moved apart. For an initial B or C contact defect, the special rule increases severity by one level.";
    }
    if (/\b(low.?cycle)\b/.test(q)) {
      return "Low-cycle means roughly 1-2 cycles per vehicle trip, such as interaction with a seat or door. Low-cycle rubbing on a friendly surface receives a one-level severity reduction.";
    }
    if (/\b(8\s*mm|diameter|small cable|small hose)\b/.test(q)) {
      return "Electric cable or rubber hose below 8 mm under vibration is not graded. Electric cable below 8 mm against a protector end is also not graded unless the surface is aggressive or the contact is hard.";
    }
    if (/\b(aggressive|friendly|surface)\b/.test(q)) return TOPICS.aggressive;
    if (/\b(safety|non.?safety)\b/.test(q)) return TOPICS.safety;
    if (/\b(high.?speed|rotation|relative motion|rubbing|vibration|movement)\b/.test(q)) return TOPICS.movement;
    if (/\b(thermal|heat.?source|heatshield|heat shield|temperature)\b/.test(q)) return TOPICS.heat;
    if (/\b(proximity|clearance|3\s*mm)\b/.test(q)) return TOPICS.proximity;
    if (/\b(contact|touching)\b/.test(q)) return TOPICS.contact;
    if (/\b(protection|protector|sleeve|tape)\b/.test(q)) return TOPICS.protection;
    if (/\b(validated|dq booklet|approved contact)\b/.test(q)) return TOPICS.validated;
    if (/\b(special rule|exception)\b/.test(q)) return TOPICS.special;
    if (/\b(help|what can you|topics)\b/.test(q)) {
      return "I can:\n- Evaluate the current form entries\n- Explain why a grade was produced\n- Suggest corrective actions\n- Explain Contact, Proximity and Heat Source rules\n- Explain aggressive/friendly surfaces and movement types\n- Describe inspection zones\n- Explain special rules such as below 8 mm, hard contact and low-cycle rubbing";
    }

    return "I could not match that question to the controlled CCP knowledge currently built into the system. Try asking about the current grade, recommended action, Contact, Proximity, Heat Source, a zone number, aggressive surfaces, movement or a special rule.";
  }

  const api = { reply, assessmentReply, topics: TOPICS };
  root.CCPAssistant = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
