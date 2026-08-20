(function (root) {
  "use strict";

  const NO_GRADE = "No grade";
  const GRADE_ORDER = { S: 4, A: 3, B: 2, C: 1, "No grade": 0 };

  const CONTACT_MATRIX = {
    "metal|aggressive": ["S", "A", "S", "A", "S", "A"],
    "metal|friendly": ["S", "A", "A", "B", "B", "C"],
    "plastic|aggressive": ["S", "A", "A", "A", "A", "A"],
    "plastic|friendly": ["S", "A", "B", "B", "B", "C"],
    "rubber|friendly": ["S", "A", "B", "B", "B", "C"],
    "felt|aggressive": ["B", "B", "B", "C", "C", "C"],
    "felt|friendly": ["B", "B", NO_GRADE, NO_GRADE, NO_GRADE, NO_GRADE]
  };

  const PROXIMITY_MATRIX = {
    "metal|aggressive": ["A", "B", "A", "B", "A", "C"],
    "metal|friendly": ["A", "B", "B", "C", NO_GRADE, NO_GRADE],
    "plastic|aggressive": ["A", "B", "B", "C", "B", "C"],
    "plastic|friendly": ["A", "B", "C", NO_GRADE, NO_GRADE, NO_GRADE],
    "rubber|friendly": ["A", "B", "C", NO_GRADE, NO_GRADE, NO_GRADE]
  };

  const HEAT_THRESHOLDS = {
    above: {
      wiring: { plain: [150, 200], shielded: [35, 50] },
      rigid: { plain: [75, 100], shielded: [35, 50] },
      rubber: { plain: [60, 80], shielded: [35, 50] }
    },
    below: {
      wiring: { plain: [100, 200], shielded: [25, 50] },
      rigid: { plain: [50, 100], shielded: [25, 50] },
      rubber: { plain: [40, 80], shielded: [25, 50] }
    }
  };

  function matrixIndex(movement, safety) {
    const base = { rotation: 0, relative: 2, vibration: 4 }[movement];
    if (base === undefined) throw new Error("Select a valid movement type.");
    return base + (safety ? 0 : 1);
  }

  function lookup(matrix, material, surface, movement, safety) {
    const row = matrix[`${material}|${surface}`];
    if (!row) throw new Error("This material and surface combination is not defined in the official grid.");
    return row[matrixIndex(movement, safety)];
  }

  function moreSevere(a, b) {
    return GRADE_ORDER[a] >= GRADE_ORDER[b] ? a : b;
  }

  function increaseOne(grade) {
    return { C: "B", B: "A", A: "S", S: "S", "No grade": NO_GRADE }[grade];
  }

  function decreaseOne(grade) {
    return { S: "A", A: "B", B: "C", C: NO_GRADE, "No grade": NO_GRADE }[grade];
  }

  function basePcwType(pcwType) {
    return String(pcwType || "").replace(/_under_8$/, "");
  }

  function isUnder8mm(input) {
    const pcwType = String(input.pcwType || "");
    if (pcwType.endsWith("_under_8")) return true;
    const diameter = Number(input.diameter);
    return Number.isFinite(diameter) && diameter < 8;
  }

  function thermalReduction(grade) {
    return { S: "B", A: "C", B: NO_GRADE, C: NO_GRADE, "No grade": NO_GRADE }[grade];
  }

  function baseResult(type) {
    return { type, initialGrade: NO_GRADE, finalGrade: NO_GRADE, rules: [], warnings: [] };
  }

  function validatedResult(type) {
    const result = baseResult(type);
    result.rules.push("Known in the approved DQ/validated-contact reference: not counted as a new defect.");
    return result;
  }

  function evaluateContact(input) {
    const result = baseResult("Contact");
    if (!input.contactPresent) {
      result.rules.push("No physical contact was identified.");
      return result;
    }
    if (input.validated) return validatedResult("Contact");

    let grade = lookup(CONTACT_MATRIX, input.material, input.surface, input.movement, input.safety);
    result.initialGrade = grade;
    result.rules.push(`Official contact grid: ${input.material}, ${input.surface}, ${input.movement}, ${input.safety ? "safety" : "non-safety"} -> ${grade}.`);

    if (input.twoUnprotected && input.secondaryGrade) {
      const previous = grade;
      grade = moreSevere(grade, input.secondaryGrade);
      result.rules.push(`Two unprotected PCWs: retained the higher grade of ${previous} and ${input.secondaryGrade} -> ${grade}.`);
    }

    const pcwType = basePcwType(input.pcwType);
    const isSmall = isUnder8mm(input);
    const isCableOrHose = pcwType === "electric_cable" || pcwType === "rubber_hose";

    if (input.movement === "vibration" && isCableOrHose && isSmall) {
      grade = NO_GRADE;
      result.rules.push("Special rule 3: electric cable/rubber hose below 8 mm under vibration is not graded.");
    } else if (input.protectorEnd && pcwType === "electric_cable" && isSmall && input.surface !== "aggressive" && !input.hardContact) {
      grade = NO_GRADE;
      result.rules.push("Special rule 4: electric cable below 8 mm against a protector end is not graded; no aggressive surface or hard contact exception applies.");
    } else {
      if (input.hardContact && (grade === "B" || grade === "C")) {
        const previous = grade;
        grade = increaseOne(grade);
        result.rules.push(`Special rule 5: hard contact/concentrated load raises ${previous} by one level -> ${grade}.`);
      }
      if (input.lowCycle && input.movement === "relative" && input.surface === "friendly") {
        const previous = grade;
        grade = decreaseOne(grade);
        result.rules.push(`Special rule 6: low-cycle rubbing on a friendly surface lowers ${previous} by one level -> ${grade}.`);
      }
      if (input.protected && input.surface === "friendly" && input.movement === "vibration") {
        grade = NO_GRADE;
        result.rules.push("Special rule 7: protected PCW against a friendly part under vibration is not graded.");
      }
      if (input.antiAbrasion && ["plastic_tube", "metal_tube"].includes(pcwType) && input.surface === "friendly" && ["vibration", "relative"].includes(input.movement)) {
        grade = NO_GRADE;
        result.rules.push("Special rule 8: plastic/metal tube with anti-abrasion sleeve against a friendly surface under vibration/relative motion is not graded.");
      }
    }

    result.finalGrade = grade;
    return result;
  }

  function evaluateProximity(input) {
    const result = baseResult("Proximity");
    if (input.validated) return validatedResult("Proximity");
    const clearance = Number(input.clearance);
    if (!Number.isFinite(clearance) || clearance < 0) throw new Error("Enter a valid clearance in millimetres.");
    if (clearance >= 3) {
      result.rules.push(`Measured clearance ${clearance} mm is not below the 3 mm VLO proximity trigger.`);
      return result;
    }
    const grade = lookup(PROXIMITY_MATRIX, input.material, input.surface, input.movement, input.safety);
    result.initialGrade = grade;
    result.finalGrade = grade;
    result.rules.push(`Official proximity grid (<3 mm): ${input.material}, ${input.surface}, ${input.movement}, ${input.safety ? "safety" : "non-safety"} -> ${grade}.`);
    if (input.twoUnprotected && input.secondaryGrade) {
      result.finalGrade = moreSevere(grade, input.secondaryGrade);
      result.rules.push(`Two unprotected PCWs: retained the higher grade of ${grade} and ${input.secondaryGrade} -> ${result.finalGrade}.`);
    }
    return result;
  }

  function evaluateHeat(input) {
    const result = baseResult("Heat source");
    if (input.validated) return validatedResult("Heat source");
    const clearance = Number(input.clearance);
    if (!Number.isFinite(clearance) || clearance < 0) throw new Error("Enter a valid heat-source clearance in millimetres.");
    const threshold = HEAT_THRESHOLDS[input.position]?.[input.component]?.[input.heatShield ? "shielded" : "plain"];
    if (!threshold) throw new Error("Select valid heat-source inputs.");
    const [severeBelow, compliantAt] = threshold;
    let grade;
    if (clearance >= compliantAt) grade = NO_GRADE;
    else if (clearance >= severeBelow) grade = "B";
    else grade = input.safety ? "S" : "A";

    result.initialGrade = grade;
    result.rules.push(`Official heat grid: ${input.position} source, ${input.component}, ${input.heatShield ? "50 mm heatshield" : "no heatshield"}; ${severeBelow}-${compliantAt} mm is B and below ${severeBelow} mm is ${input.safety ? "S" : "A"}. Measured ${clearance} mm -> ${grade}.`);
    if (input.thermalProtection && grade !== NO_GRADE) {
      const previous = grade;
      grade = thermalReduction(grade);
      result.rules.push(`Thermal sleeve/tape reduction: ${previous} -> ${grade}.`);
    }
    result.finalGrade = grade;
    return result;
  }

  function riskFor(grade) {
    return {
      S: { label: "Safety critical", color: "red" },
      A: { label: "High", color: "red" },
      B: { label: "Medium", color: "amber" },
      C: { label: "Warning", color: "grey" },
      "No grade": { label: "No grading required", color: "green" }
    }[grade];
  }

  function actionsFor(type, grade) {
    if (grade === NO_GRADE) return ["Record the condition and supporting evidence.", "Confirm the classification and any validated-contact reference."];
    const urgent = grade === "S" || grade === "A";
    if (type === "Heat source") {
      return urgent
        ? ["Escalate to Packaging/Thermal Engineering.", "Increase clearance or reroute the PCW.", "Add an approved thermal shield, sleeve or tape and re-evaluate."]
        : ["Review clearance with Packaging/Thermal Engineering.", "Improve routing or thermal protection, then repeat the measurement."];
    }
    return urgent
      ? ["Escalate to the responsible engineering/CCP team.", "Reroute or add a positive fixing to remove the interaction.", "Use only an approved protection and repeat the inspection."]
      : ["Review routing and attachment location.", "Monitor the condition and document evidence.", "Confirm any countermeasure with the responsible engineering/CCP team."];
  }

  function evaluate(type, input) {
    const result = type === "contact" ? evaluateContact(input) : type === "proximity" ? evaluateProximity(input) : evaluateHeat(input);
    result.risk = riskFor(result.finalGrade);
    result.actions = actionsFor(result.type, result.finalGrade);
    result.source = result.type === "Contact" ? "SCA_F153_VLO_DDVLO_O10, page 15" : "SCA_F153_VLO_DDVLO_O10, page 14";
    return result;
  }

  const api = { evaluate, evaluateContact, evaluateProximity, evaluateHeat, riskFor, NO_GRADE };
  root.CCP = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
