(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const truthy = (id) => $(id).value === "true";
  const checked = (id) => $(id).checked;
  const recordsKey = "ccp-routing-inspections-v1";
  const sessionKey = "ccp-routing-current-session-v1";
  const sessionCounterKey = "ccp-routing-session-counter-v1";
  let currentResult = null;
  let lastAssistantAssessment = "";
  let professionalAIConnected = false;
  let recordsCache = [];
  let sharedRecordsEnabled = false;
  let currentSession = null;
  let editingRecordId = "";
  const assistantHistory = [];
  const defectMarkerDefaults = { top: { x: 54, y: 78 }, side: { x: 62, y: 214 } };
  const defectMarkers = {
    top: { ...defectMarkerDefaults.top },
    side: { ...defectMarkerDefaults.side }
  };
  const defectAreaVehicleImage = new Image();
  defectAreaVehicleImage.src = "assets/references/vehicle-defect-area.png";

  const zones = {
    "Under hood": [1, 2, 3, 4, 5, 6],
    "Under body": [11, 12, 13, 14, 15, 16, 17],
    "Under seats / instrument panel": [20, 21, "22A", "22B", "23A", "23B", 28],
    "Trunk / wheel arches / front grille": [24, 25, 26, 27, 29]
  };

  const routingTypeBySystem = {
    Brake: ["Brake Pipe"],
    Coolant: ["Coolant hose"],
    HV: ["HV Cable"],
    HVAC: ["AC pipe"],
    LV: ["Wiring harness"],
    Mechanism: ["Hood cable", "Wiper Hose"]
  };

  const zoneDetails = {
    "1": ["Inner side of hood and hood-latch area", "Inspect the inner hood surface and the hood-latch area.", "under-hood.png", "under-hood"],
    "2": ["Engine compartment left side", "Inspect the left side outside the engine, up to the air-input filter.", "under-hood.png", "under-hood"],
    "3": ["Engine-to-front-panel area", "Inspect the area between the engine and front panel, including the fan unit.", "under-hood.png", "under-hood"],
    "4": ["Engine, turbo and exhaust", "Inspect the engine area, including the turbo and exhaust.", "under-hood.png", "under-hood"],
    "5": ["Engine-to-bulkhead area", "Inspect the area between the engine and bulkhead.", "under-hood.png", "under-hood"],
    "6": ["Engine compartment right side", "Inspect the right side outside the engine, up to the air-input grille.", "under-hood.png", "under-hood"],
    "11": ["Front-right wheel arch", "Inspect the front-right wheel-arch routing area.", "under-body.png", "under-body"],
    "12": ["Front-left wheel arch", "Inspect the front-left wheel-arch routing area.", "under-body.png", "under-body"],
    "13": ["Lower engine compartment", "Inspect from the lower front panel to the bulkhead.", "under-body.png", "under-body"],
    "14": ["Central underbody", "Inspect the underbody between the engine compartment and boot area.", "under-body.png", "under-body"],
    "15": ["Rear-right wheel arch", "Inspect the rear-right wheel-arch routing area.", "under-body.png", "under-body"],
    "16": ["Rear-left wheel arch", "Inspect the rear-left wheel-arch routing area.", "under-body.png", "under-body"],
    "17": ["Rear underbody / trunk area", "Inspect from the crossbar to the rear bumper.", "under-body.png", "under-body"],
    "20": ["Under left-front seat", "Inspect PCW and connections beneath the left-front seat.", "under-seats-instrument-panel.png", "under-seats and instrument-panel"],
    "21": ["Under right-front seat", "Inspect PCW and connections beneath the right-front seat.", "under-seats-instrument-panel.png", "under-seats and instrument-panel"],
    "22A": ["Driver-side pedals and steering", "Inspect beneath the dashboard at the pedals and steering-column side.", "under-seats-instrument-panel.png", "under-seats and instrument-panel"],
    "22B": ["Driver-side fuse area", "Inspect beneath the dashboard at the driver-side fuse area.", "under-seats-instrument-panel.png", "under-seats and instrument-panel"],
    "23A": ["Passenger-side dashboard", "Inspect beneath the dashboard on the passenger side.", "under-seats-instrument-panel.png", "under-seats and instrument-panel"],
    "23B": ["Passenger glove-box area", "Inspect beneath the dashboard at the passenger-side glove-box area.", "under-seats-instrument-panel.png", "under-seats and instrument-panel"],
    "28": ["Second-row seats", "Inspect PCW and connections beneath and around the second-row seats.", "under-seats-instrument-panel.png", "under-seats and instrument-panel"],
    "24": ["Wheel housing", "Inspect routing in and around the wheel-housing area.", "trunk-wheel-arches-front-grille.png", "trunk, wheel-arches and front-grille"],
    "25": ["Front face", "Inspect routing behind the vehicle front face and grille.", "trunk-wheel-arches-front-grille.png", "trunk, wheel-arches and front-grille"],
    "26": ["Trunk left side", "Inspect the left side of the trunk or load compartment.", "trunk-wheel-arches-front-grille.png", "trunk, wheel-arches and front-grille"],
    "27": ["Trunk right side", "Inspect the right side of the trunk or load compartment.", "trunk-wheel-arches-front-grille.png", "trunk, wheel-arches and front-grille"],
    "29": ["Tonneau / convertible-roof area", "Inspect the tonneau and convertible-roof mechanism area where applicable.", "trunk-wheel-arches-front-grille.png", "trunk, wheel-arches and front-grille"]
  };

  function populateZones() {
    Object.entries(zones).forEach(([label, values]) => {
      const group = document.createElement("optgroup");
      group.label = label;
      values.forEach((value) => {
        const option = document.createElement("option");
        option.value = String(value);
        option.textContent = `Zone ${value}`;
        group.appendChild(option);
      });
      $("zone").appendChild(group);
    });
  }

  function updateZoneReference() {
    const zone = $("zone").value;
    const [title, description, image, altGroup] = zoneDetails[zone] || zoneDetails["1"];
    const path = `assets/zones/${image}`;
    $("zone-reference-title").textContent = `Zone ${zone} - ${title}`;
    $("zone-reference-description").textContent = description;
    $("zone-reference-image").src = path;
    $("zone-reference-image").alt = `Official ${altGroup} inspection-zone diagram showing Zone ${zone}`;
    $("zone-image-link").href = path;
  }

  function selectedType() {
    return document.querySelector('input[name="type"]:checked')?.value || "";
  }

  function updateConditionalFields() {
    const type = selectedType();
    ["contact", "proximity", "heat"].forEach((name) => $(`${name}-fields`).classList.toggle("hidden", name !== type));
    $("common-fields").classList.toggle("hidden", !type);
    $("movement-wrap").classList.toggle("hidden", type === "heat");
    $("result").classList.add("hidden");
    updateSelectedDefinitions();
  }

  function updateRoutingTypeOptions() {
    const system = $("routing-system").value;
    const customSystem = system === "__custom__";
    $("custom-system-wrap").classList.toggle("hidden", !customSystem);
    if (!customSystem) $("custom-system").value = "";
    const options = routingTypeBySystem[system] || [];
    const placeholder = Object.assign(document.createElement("option"), { value: "", textContent: customSystem ? "Choose routing type" : (options.length ? "Choose routing type" : "Choose system first") });
    const custom = Object.assign(document.createElement("option"), { value: "__custom__", textContent: "Other / new routing type" });
    $("routing-type").replaceChildren(placeholder, ...options.map((value) => Object.assign(document.createElement("option"), { value, textContent: value })), custom);
    $("custom-routing-wrap").classList.add("hidden");
    $("custom-routing-type").value = "";
    if (customSystem) $("routing-type").value = "__custom__";
    updateCustomRoutingField();
  }

  function updateCustomRoutingField() {
    const custom = $("routing-type").value === "__custom__";
    $("custom-routing-wrap").classList.toggle("hidden", !custom);
    if (!custom) $("custom-routing-type").value = "";
  }

  function normalizeSurfaceOptions(materialId, surfaceId) {
    const material = $(materialId).value;
    const select = $(surfaceId);
    const aggressive = select.querySelector('option[value="aggressive"]');
    const onlyFriendly = material === "rubber";
    aggressive.disabled = onlyFriendly;
    if (onlyFriendly) select.value = "friendly";
    updateSelectedDefinitions();
  }

  const featureDefinitions = {
    "": "Choose whether this condition affects a safety feature or non-safety feature before evaluating.",
    true: "Safety and braking, steering, fuel system regulation, SCR circuit, battery/starter positive wiring and high-voltage orange cables.",
    false: "Water, air, oil and other non-safety pipes; general wiring except battery/starter positive wiring; ground wires and 48V purple cables."
  };

  const movementDefinitions = {
    "": "Choose the movement condition before evaluating contact or proximity.",
    rotation: "Contact with rotating parts such as pulleys, engine belts, wheels, tires, drive shafts, steering columns, ground contact or fans.",
    relative: "Movement between components on areas with different movement conditions, for example body vs suspension, engine vs body or exhaust routing.",
    vibration: "Two components mounted in the same reference frame. Low-energy vibration may not be visible but can still create failure at contact locations."
  };

  const surfaceDefinitions = {
    "": "Choose whether the contact surface is aggressive or friendly before evaluating.",
    aggressive: "Contact on a part edge, non-radiated edge, abrasive surface or significant heat source.",
    friendly: "Contact on a smoother surface with a larger bearing area. If it is not aggressive, classify it as friendly."
  };

  function updateSelectedDefinitions() {
    if ($("safety")) $("feature-help-text").textContent = featureDefinitions[$("safety").value];
    if ($("movement")) $("movement-help-text").textContent = movementDefinitions[$("movement").value];
    if ($("contact-surface")) $("surface-help-text").textContent = surfaceDefinitions[$("contact-surface").value];
  }

  function collectInput(type) {
    const common = { validated: false, safety: truthy("safety"), movement: $("movement").value };
    if (type === "contact") return {
      ...common,
      contactPresent: true, material: $("contact-material").value, surface: $("contact-surface").value,
      pcwType: selectedPcwTypeForRules(), pcwTypeLabel: selectedPcwTypeLabel(), protected: false, protectorApplication: "",
      protectorClassification: "", protectorExternalSurface: "",
      protectorEnd: checked("protector-end"), hardContact: checked("hard-contact"), lowCycle: checked("low-cycle"),
      antiAbrasion: false,
      twoUnprotected: false, secondaryGrade: ""
    };
    if (type === "proximity") return {
      ...common,
      clearance: $("proximity-clearance").value, material: $("proximity-material").value, surface: $("proximity-surface").value,
      twoUnprotected: checked("two-proximity"), secondaryGrade: $("secondary-proximity-grade").value
    };
    return {
      validated: common.validated, safety: common.safety, position: $("heat-position").value, component: $("heat-component").value,
      clearance: $("heat-clearance").value, heatShield: truthy("heat-shield"), thermalProtection: truthy("thermal-protection")
    };
  }

  function validateEvaluation(type) {
    const missing = [];
    const requireValue = (id, label) => {
      if (!$(id).value) missing.push(label);
    };
    const requireNumber = (id, label) => {
      const raw = $(id).value;
      const number = Number(raw);
      if (raw === "" || !Number.isFinite(number) || number < 0) missing.push(label);
    };

    if (!type) missing.push("condition type: Contact, Proximity or Heat source");

    if (type === "contact" || type === "proximity" || type === "heat") {
      requireValue("powertrain", "powertrain / function");
      requireValue("routing-system", "system");
      if ($("routing-system").value === "__custom__" && !$("custom-system").value.trim()) missing.push("new system");
      requireValue("routing-type", "routing type");
      if ($("routing-type").value === "__custom__" && !$("custom-routing-type").value.trim()) missing.push("new routing type");
      requireValue("safety", "feature classification");
    }
    if (type === "contact" || type === "proximity") {
      requireValue("movement", "movement");
    }

    if (type === "contact") {
      requireValue("contact-material", "contact-part material");
      requireValue("contact-surface", "contact surface");
    } else if (type === "proximity") {
      requireNumber("proximity-clearance", "measured proximity clearance");
      requireValue("proximity-material", "opposite-part material");
      requireValue("proximity-surface", "proximity surface");
    } else if (type === "heat") {
      requireValue("heat-position", "component position");
      requireValue("heat-component", "PCW group");
      requireNumber("heat-clearance", "measured heat-source clearance");
      requireValue("heat-shield", "50 mm heatshield status");
      requireValue("thermal-protection", "thermal sleeve or tape status");
    }

    return missing;
  }

  function judgementExplanation(result) {
    const specialRules = result.rules.filter((rule) => /Special rule|Thermal sleeve|Two unprotected/i.test(rule));
    if (!specialRules.length) {
      return `Why this grade: the official ${result.type.toLowerCase()} rating table gave ${result.finalGrade}, and no special case changed the judgement.`;
    }
    const specialText = specialRules.map((rule) => rule.replace(/\.$/, "")).join(" ");
    if (result.initialGrade !== result.finalGrade) {
      return `Why this grade: the rating table first gave ${result.initialGrade}. Then the special case validation was applied: ${specialText}. Therefore the final grade is ${result.finalGrade}.`;
    }
    return `Why this grade: the rating table gave ${result.finalGrade}. The system also checked the special case validation: ${specialText}. The final grade remains ${result.finalGrade}.`;
  }

  function showResult(result, shouldScroll = true) {
    currentResult = result;
    $("result-title").textContent = `${result.type} evaluation complete`;
    $("result-summary").textContent = `Initial grade: ${result.initialGrade}. Final grade after applicable rules: ${result.finalGrade}.`;
    $("result-explanation").textContent = judgementExplanation(result);
    $("grade").textContent = result.finalGrade;
    $("risk").textContent = result.risk.label;
    $("grade-badge").className = `grade-badge ${result.risk.color}`;
    $("rules").replaceChildren(...result.rules.map((rule) => Object.assign(document.createElement("li"), { textContent: rule })));
    $("actions").replaceChildren(...result.actions.map((action) => Object.assign(document.createElement("li"), { textContent: action })));
    $("source").textContent = `Rule source: ${result.source}. Definitions and countermeasures: CS.CCP-ROUTINGS (HARMONIZED), sections 5, 7-10.`;
    $("result").classList.remove("hidden");
    const signature = `${result.type}|${result.initialGrade}|${result.finalGrade}|${result.rules.join(";")}`;
    if (signature !== lastAssistantAssessment) {
      addAssistantMessage("ai", `I reviewed the completed assessment. The final grade is ${result.finalGrade} (${result.risk.label}). ${judgementExplanation(result)}`);
      lastAssistantAssessment = signature;
    }
    if (shouldScroll) $("result").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function resultFromRecord(record) {
    const finalGrade = record.grade || "No grade";
    return {
      type: record.type || conditionTypeValue(record.type),
      initialGrade: record.initialGrade || finalGrade,
      finalGrade,
      rules: String(record.decisionTrail || "Saved inspection loaded for editing.").split(" | ").filter(Boolean),
      actions: String(record.actions || "Review and update the inspection if needed.").split(" | ").filter(Boolean),
      risk: CCP.riskFor(finalGrade) || { label: record.risk || "", color: "grey" },
      source: String(record.type || "").toLowerCase().includes("heat") ? "SCA_F153_VLO_DDVLO_O10, page 14" : "SCA_F153_VLO_DDVLO_O10, page 15"
    };
  }

  function currentEvaluationSnapshot(type = selectedType()) {
    return {
      type,
      input: collectInput(type),
      powertrain: $("powertrain").value,
      routingSystemValue: $("routing-system").value,
      customSystem: $("custom-system").value.trim(),
      routingTypeValue: $("routing-type").value,
      customRoutingType: $("custom-routing-type").value.trim()
    };
  }

  function assistantContext() {
    const zoneId = $("zone").value;
    const zoneRaw = zoneDetails[zoneId] || zoneDetails["1"];
    let draftResult = null;
    try { draftResult = CCP.evaluate(selectedType(), collectInput(selectedType())); } catch { draftResult = null; }
    return {
      result: currentResult,
      draftResult,
      zone: { id: zoneId, title: zoneRaw[0], description: zoneRaw[1] },
      findZone: (id) => {
        const info = zoneDetails[id];
        return info ? { title: info[0], description: info[1] } : null;
      }
    };
  }

  function addAssistantMessage(role, message, label) {
    const bubble = document.createElement("div");
    bubble.className = `assistant-message ${role === "user" ? "user" : "ai"}`;
    const name = document.createElement("strong");
    name.textContent = label || (role === "user" ? "You" : "CCP Assistant");
    const text = document.createElement("span");
    text.textContent = message;
    bubble.append(name, text);
    $("assistant-messages").appendChild(bubble);
    $("assistant-messages").scrollTop = $("assistant-messages").scrollHeight;
    return bubble;
  }

  function remoteAssistantContext() {
    const context = assistantContext();
    const assessment = context.result || context.draftResult;
    return {
      selectedZone: context.zone,
      selectedCondition: selectedType(),
      deterministicAssessment: assessment ? {
        type: assessment.type, initialGrade: assessment.initialGrade, finalGrade: assessment.finalGrade,
        risk: assessment.risk.label, appliedRules: assessment.rules, recommendedActions: assessment.actions,
        source: assessment.source
      } : null
    };
  }

  function setAssistantStatus(connected, message) {
    professionalAIConnected = connected;
    $("assistant-status").textContent = message;
    $("assistant-status").className = `offline-pill ${connected ? "connected" : "error"}`;
  }

  async function checkProfessionalAI() {
    if (!location.protocol.startsWith("http")) {
      setAssistantStatus(false, "Offline CCP mode");
      return;
    }
    try {
      const response = await fetch("/api/health", { cache: "no-store" });
      const data = await response.json();
      setAssistantStatus(Boolean(data.professionalAI), data.professionalAI ? `Professional AI - ${data.model}` : "Offline CCP mode");
    } catch { setAssistantStatus(false, "Offline CCP mode"); }
  }

  async function askAssistant(question) {
    const clean = String(question || "").trim();
    if (!clean) return;
    addAssistantMessage("user", clean);
    const priorHistory = assistantHistory.slice(-10);
    assistantHistory.push({ role: "user", text: clean });
    if (!professionalAIConnected) {
      const answer = CCPAssistant.reply(clean, assistantContext());
      addAssistantMessage("ai", answer, "Offline CCP Assistant");
      assistantHistory.push({ role: "assistant", text: answer });
      return;
    }

    const thinking = addAssistantMessage("ai", "Thinking...", "Professional AI");
    thinking.classList.add("thinking");
    try {
      const response = await fetch("/api/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: clean, context: remoteAssistantContext(), history: priorHistory })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "AI request failed");
      thinking.remove();
      addAssistantMessage("ai", data.answer, `Professional AI - ${data.model}`);
      assistantHistory.push({ role: "assistant", text: data.answer });
    } catch (error) {
      thinking.remove();
      setAssistantStatus(false, "Offline CCP mode");
      const fallback = `${error.message}\n\nOffline answer:\n${CCPAssistant.reply(clean, assistantContext())}`;
      addAssistantMessage("ai", fallback, "Offline CCP Assistant");
      assistantHistory.push({ role: "assistant", text: fallback });
    }
  }

  function caseMetadata() {
    const photoNames = Array.from($("photo").files || []).map((file) => file.name).join(", ");
    return {
      vehicle: $("vehicle").value.trim(), zone: $("zone").value,
      inspector: $("inspector").value.trim(), date: $("date").value, observation: $("observation").value.trim(),
      photo: photoNames,
      defectMarkerTopX: defectMarkers.top.x,
      defectMarkerTopY: defectMarkers.top.y,
      defectMarkerSideX: defectMarkers.side.x,
      defectMarkerSideY: defectMarkers.side.y
    };
  }

  function waitForDefectAreaVehicleImage() {
    if (defectAreaVehicleImage.complete && defectAreaVehicleImage.naturalWidth) return Promise.resolve();
    return new Promise((resolve) => {
      defectAreaVehicleImage.onload = resolve;
      defectAreaVehicleImage.onerror = resolve;
    });
  }

  function drawVehicleMarker(context, markers = defectMarkers) {
    context.clearRect(0, 0, 320, 320);
    context.fillStyle = "#dfeaf5";
    context.fillRect(0, 0, 320, 320);
    if (defectAreaVehicleImage.complete && defectAreaVehicleImage.naturalWidth) {
      const box = { x: 10, y: 4, width: 300, height: 312 };
      const scale = Math.min(box.width / defectAreaVehicleImage.naturalWidth, box.height / defectAreaVehicleImage.naturalHeight);
      const width = defectAreaVehicleImage.naturalWidth * scale;
      const height = defectAreaVehicleImage.naturalHeight * scale;
      context.drawImage(defectAreaVehicleImage, box.x + (box.width - width) / 2, box.y + (box.height - height) / 2, width, height);
    }

    Object.values(markers).forEach((marker) => {
      context.fillStyle = "#ff0000";
      context.strokeStyle = "#111";
      context.lineWidth = 1.2;
      context.beginPath();
      context.arc(marker.x, marker.y, 6, 0, Math.PI * 2);
      context.fill();
      context.stroke();
    });
  }

  async function defectAreaImageData() {
    await waitForDefectAreaVehicleImage();
    const canvas = document.createElement("canvas");
    canvas.width = 320;
    canvas.height = 320;
    drawVehicleMarker(canvas.getContext("2d"));
    try {
      return canvas.toDataURL("image/png");
    } catch {
      return "";
    }
  }

  function renderDefectMarkers() {
    $("top-defect-dot").setAttribute("cx", defectMarkers.top.x);
    $("top-defect-dot").setAttribute("cy", defectMarkers.top.y);
    $("side-defect-dot").setAttribute("cx", defectMarkers.side.x);
    $("side-defect-dot").setAttribute("cy", defectMarkers.side.y);
  }

  function resetDefectMarkers() {
    defectMarkers.top = { ...defectMarkerDefaults.top };
    defectMarkers.side = { ...defectMarkerDefaults.side };
    renderDefectMarkers();
  }

  function defectMarkerBounds(view) {
    return view === "top"
      ? { minX: 20, maxX: 300, minY: 20, maxY: 136 }
      : { minX: 20, maxX: 300, minY: 166, maxY: 310 };
  }

  function setDefectMarkerPosition(view, x, y) {
    const bounds = defectMarkerBounds(view);
    defectMarkers[view].x = Math.max(bounds.minX, Math.min(bounds.maxX, x));
    defectMarkers[view].y = Math.max(bounds.minY, Math.min(bounds.maxY, y));
  }

  function setDefectMarkerFromEvent(event, view) {
    const svg = $("defect-area-svg");
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const svgPoint = point.matrixTransform(svg.getScreenCTM().inverse());
    setDefectMarkerPosition(view, svgPoint.x, svgPoint.y);
    renderDefectMarkers();
  }

  function setupDefectAreaMarker() {
    const svg = $("defect-area-svg");
    let activeView = "";
    svg.addEventListener("pointerdown", (event) => {
      const view = event.target.closest("[data-view]")?.dataset.view;
      if (!view) return;
      activeView = view;
      svg.setPointerCapture(event.pointerId);
      setDefectMarkerFromEvent(event, activeView);
    });
    svg.addEventListener("pointermove", (event) => {
      if (activeView) setDefectMarkerFromEvent(event, activeView);
    });
    ["pointerup", "pointercancel", "pointerleave"].forEach((name) => svg.addEventListener(name, () => { activeView = ""; }));
    renderDefectMarkers();
  }

  function readPhotoDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error || new Error("Could not read photo."));
      reader.readAsDataURL(file);
    });
  }

  async function compressedPhotoFile(file) {
    const source = await readPhotoDataUrl(file);
    const image = new Image();
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error("Could not prepare photo for report."));
      image.src = source;
    });
    const maxSide = 700;
    const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const context = canvas.getContext("2d");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.72);
  }

  async function compressedPhotoDataList() {
    const files = Array.from($("photo").files || []).filter((file) => file.type.startsWith("image/")).slice(0, 4);
    const photos = [];
    for (const file of files) photos.push(await compressedPhotoFile(file));
    return photos;
  }

  async function compressedPhotoData() {
    return (await compressedPhotoDataList())[0] || "";
  }

  function indexNumber(record) {
    return record.zone ? `Zone ${record.zone}` : (record.checkpoint || "");
  }

  function getLocalRecords() {
    try { return JSON.parse(localStorage.getItem(recordsKey) || "[]"); } catch { return []; }
  }

  function setLocalRecords(rows) {
    localStorage.setItem(recordsKey, JSON.stringify(rows));
  }

  function createSession() {
    const nextSessionNo = Number(localStorage.getItem(sessionCounterKey) || "0") + 1;
    localStorage.setItem(sessionCounterKey, String(nextSessionNo));
    return {
      id: `S${nextSessionNo}-${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 17)}`,
      number: nextSessionNo,
      label: `Session ${nextSessionNo}`,
      startedAt: new Date().toISOString(),
      nextConcernNo: 1
    };
  }

  function saveSession() {
    localStorage.setItem(sessionKey, JSON.stringify(currentSession));
  }

  function ensureSessionLabel() {
    if (!currentSession) return;
    const storedCounter = Number(localStorage.getItem(sessionCounterKey) || "0");
    if (!Number.isFinite(Number(currentSession.number))) {
      const sessionNo = storedCounter > 0 ? storedCounter : 1;
      currentSession.number = sessionNo;
      localStorage.setItem(sessionCounterKey, String(Math.max(storedCounter, sessionNo)));
    } else {
      localStorage.setItem(sessionCounterKey, String(Math.max(storedCounter, Number(currentSession.number))));
    }
    currentSession.label = currentSession.label || `Session ${currentSession.number}`;
  }

  function sessionLabel() {
    if (!currentSession) return "Session";
    return currentSession.label || `Session ${currentSession.number || currentSession.id}`;
  }

  function currentSessionRows() {
    return recordsCache.filter((record) => record.sessionId === currentSession?.id);
  }

  function initSession(forceNew = false) {
    if (!forceNew) {
      try { currentSession = JSON.parse(localStorage.getItem(sessionKey) || "null"); } catch { currentSession = null; }
    }
    if (forceNew || !currentSession || !currentSession.id || !Number.isFinite(Number(currentSession.nextConcernNo))) {
      currentSession = createSession();
    }
    ensureSessionLabel();
    currentSession.nextConcernNo = Number(currentSession.nextConcernNo) || 1;
    saveSession();
    updateSessionStatus();
  }

  function startEntrySession() {
    localStorage.removeItem(sessionKey);
    localStorage.setItem(sessionCounterKey, "0");
    initSession(true);
  }

  function updateSessionStatus() {
    if (!currentSession) return;
    const savedCount = currentSessionRows().length;
    const nextNo = Number(currentSession.nextConcernNo) || 1;
    $("session-status").textContent = `${sessionLabel()} | Saved: ${savedCount} | Next No. ${nextNo}`;
    if ($("session-summary")) {
      $("session-summary").textContent = `Current session: ${sessionLabel()} | Saved inspections in this session: ${savedCount} | Next concern No. ${nextNo}`;
    }
  }

  function advanceSessionCounter() {
    currentSession.nextConcernNo = Number(currentSession.nextConcernNo || 1) + 1;
    saveSession();
    updateSessionStatus();
  }

  function startNewSession() {
    initSession(true);
    resetCase();
    renderRecords();
    showRecordsAction(`${sessionLabel()} started. Concern numbering reset to No. 1.`);
  }

  function setRecordStorageStatus(shared, message) {
    sharedRecordsEnabled = shared;
    $("records-mode-label").textContent = shared ? "Shared audit trail" : "Local audit trail";
    $("record-storage-note").textContent = message;
  }

  function showRecordsAction(message) {
    $("records-action-note").textContent = message;
    $("records-action-note").classList.remove("hidden");
    setTimeout(() => $("records-action-note").classList.add("hidden"), 3500);
  }

  function renderRecords() {
    const rows = currentSession ? currentSessionRows() : recordsCache;
    $("empty-records").classList.toggle("hidden", rows.length > 0);
    $("records-body").replaceChildren(...rows.slice().reverse().map((record) => {
      const tr = document.createElement("tr");
      [record.concernNo, record.date, indexNumber(record), record.vehicle, record.type, record.grade, record.risk].forEach((value, index) => {
        const td = document.createElement("td");
        td.textContent = value || "-";
        if (index === 5) td.className = "grade-cell";
        tr.appendChild(td);
      });
      const actions = document.createElement("td");
      const actionWrap = document.createElement("div");
      actionWrap.className = "record-row-actions";
      const editButton = document.createElement("button");
      editButton.type = "button";
      editButton.textContent = "Edit";
      editButton.addEventListener("click", () => editSavedRecord(record.id));
      const removeButton = document.createElement("button");
      removeButton.type = "button";
      removeButton.textContent = "Remove";
      removeButton.className = "remove-record";
      removeButton.addEventListener("click", () => removeSavedRecord(record.id));
      actionWrap.append(editButton, removeButton);
      actions.appendChild(actionWrap);
      tr.appendChild(actions);
      return tr;
    }));
    updateSessionStatus();
  }

  async function replaceSavedRecord(updatedRecord) {
    if (sharedRecordsEnabled && location.protocol.startsWith("http")) {
      const response = await fetch("/api/records", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ record: updatedRecord })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not update shared record.");
      recordsCache = Array.isArray(data.records) ? data.records : recordsCache.map((record) => record.id === updatedRecord.id ? updatedRecord : record);
    } else {
      recordsCache = getLocalRecords().map((record) => record.id === updatedRecord.id ? updatedRecord : record);
      setLocalRecords(recordsCache);
    }
  }

  function conditionTypeValue(recordType) {
    const clean = String(recordType || "").toLowerCase();
    if (clean.includes("contact")) return "contact";
    if (clean.includes("proximity")) return "proximity";
    if (clean.includes("heat")) return "heat";
    return clean;
  }

  function setConditionType(type) {
    document.querySelectorAll('input[name="type"]').forEach((input) => { input.checked = input.value === type; });
    updateConditionalFields();
  }

  function setSelectValueOrCustom(selectId, customInputId, value) {
    const select = $(selectId);
    const clean = String(value || "").trim();
    if (!clean) {
      select.value = "";
      return;
    }
    const option = Array.from(select.options).find((item) => item.value === clean || item.textContent === clean);
    if (option) {
      select.value = option.value;
      return;
    }
    if (Array.from(select.options).some((item) => item.value === "__custom__")) {
      select.value = "__custom__";
      if (customInputId) $(customInputId).value = clean;
    }
  }

  function pcwTypeValueFromLabel(label) {
    const clean = String(label || "").toLowerCase();
    if (!clean) return "";
    if (clean.includes("below 8") && clean.includes("electric")) return "electric_cable_under_8";
    if (clean.includes("electric") || clean.includes("wiring")) return "electric_cable";
    if (clean.includes("below 8") && clean.includes("rubber")) return "rubber_hose_under_8";
    if (clean.includes("rubber")) return "rubber_hose";
    if (clean.includes("plastic")) return "plastic_tube";
    if (clean.includes("metal")) return "metal_tube";
    return "";
  }

  function pcwTypeValueFromRoutingType(routingType) {
    const clean = String(routingType || "").toLowerCase();
    if (clean.includes("wiring") || clean.includes("cable") || clean.includes("hv")) return "electric_cable";
    if (clean.includes("coolant") || clean.includes("wiper") || clean.includes("hose")) return "rubber_hose";
    if (clean.includes("brake") || clean.includes("pipe")) return "metal_tube";
    return "";
  }

  function inferredInputFromRecord(record) {
    const trail = `${record.decisionTrail || ""} ${record.reportDefaultDetail || ""}`;
    const input = {};
    const grid = trail.match(/Official (contact|proximity) grid(?: \(<3 mm\))?:\s*([^,]+),\s*([^,]+),\s*([^,]+),\s*(safety|non-safety)/i);
    if (grid) {
      input.material = grid[2].trim().toLowerCase();
      input.surface = grid[3].trim().toLowerCase();
      input.movement = grid[4].trim().toLowerCase();
      input.safety = grid[5].trim().toLowerCase() === "safety";
    }
    const heat = trail.match(/Official heat grid:\s*(above|below) source,\s*([^,]+),\s*(50 mm heatshield|no heatshield).*?Measured\s*([0-9.]+)\s*mm/i);
    if (heat) {
      input.position = heat[1].trim().toLowerCase();
      const componentText = heat[2].trim().toLowerCase();
      input.component = componentText.includes("wiring") ? "wiring" : componentText.includes("rubber") ? "rubber" : "rigid";
      input.heatShield = heat[3].toLowerCase().includes("50 mm");
      input.clearance = heat[4];
      input.thermalProtection = /thermal sleeve\/tape reduction/i.test(trail);
    }
    const pcwType = pcwTypeValueFromLabel(record.pcwType) || pcwTypeValueFromRoutingType(record.routingType);
    if (pcwType) input.pcwType = pcwType;
    if (/protected PCW|anti-abrasion sleeve|thermal sleeve|tape/i.test(trail)) input.protected = true;
    if (/anti-abrasion sleeve/i.test(trail)) input.protectorApplication = "anti_abrasion";
    if (/protector end/i.test(trail)) input.protectorEnd = true;
    if (/hard contact|concentrated load/i.test(trail)) input.hardContact = true;
    if (/low-cycle rubbing/i.test(trail)) input.lowCycle = true;
    if (/two unprotected PCWs/i.test(trail)) input.twoUnprotected = true;
    if (record.grade) input.secondaryGrade = record.grade;
    return input;
  }

  function loadRecordIntoForm(record) {
    const snapshot = record.evaluationSnapshot || {};
    const input = { ...inferredInputFromRecord(record), ...(snapshot.input || {}) };
    $("vehicle").value = record.vehicle || "";
    $("zone").value = record.zone || "1";
    $("inspector").value = record.inspector || "";
    $("date").value = record.date || new Date().toISOString().slice(0, 10);
    $("observation").value = record.observation || "";
    updateZoneReference();

    setConditionType(snapshot.type || conditionTypeValue(record.type));
    $("powertrain").value = snapshot.powertrain || record.powertrain || "";

    setSelectValueOrCustom("routing-system", "custom-system", snapshot.routingSystemValue === "__custom__" ? snapshot.customSystem : (record.system || snapshot.routingSystemValue));
    updateRoutingTypeOptions();
    setSelectValueOrCustom("routing-type", "custom-routing-type", snapshot.routingTypeValue === "__custom__" ? snapshot.customRoutingType : (record.routingType || snapshot.routingTypeValue));
    updateCustomRoutingField();

    if ($("safety")) $("safety").value = input.safety === true ? "true" : input.safety === false ? "false" : "";
    if ($("movement")) $("movement").value = input.movement || "";

    if (selectedType() === "contact") {
      $("contact-material").value = input.material || "";
      normalizeSurfaceOptions("contact-material", "contact-surface");
      $("contact-surface").value = input.surface || "";
      $("protector-end").checked = Boolean(input.protectorEnd);
      $("hard-contact").checked = Boolean(input.hardContact);
      $("low-cycle").checked = Boolean(input.lowCycle);
    } else if (selectedType() === "proximity") {
      $("proximity-clearance").value = input.clearance || "";
      $("proximity-material").value = input.material || "";
      normalizeSurfaceOptions("proximity-material", "proximity-surface");
      $("proximity-surface").value = input.surface || "";
      $("two-proximity").checked = Boolean(input.twoUnprotected);
      $("secondary-proximity-wrap").classList.toggle("hidden", !checked("two-proximity"));
      $("secondary-proximity-grade").value = input.secondaryGrade || "A";
    } else if (selectedType() === "heat") {
      $("heat-position").value = input.position || "";
      $("heat-component").value = input.component || "";
      $("heat-clearance").value = input.clearance || "";
      $("heat-shield").value = input.heatShield === true ? "true" : input.heatShield === false ? "false" : "";
      $("thermal-protection").value = input.thermalProtection === true ? "true" : input.thermalProtection === false ? "false" : "";
    }

    setDefectMarkerPosition("top", Number(record.defectMarkerTopX) || defectMarkerDefaults.top.x, Number(record.defectMarkerTopY) || defectMarkerDefaults.top.y);
    setDefectMarkerPosition("side", Number(record.defectMarkerSideX) || defectMarkerDefaults.side.x, Number(record.defectMarkerSideY) || defectMarkerDefaults.side.y);
    renderDefectMarkers();
    updateSelectedDefinitions();
    showResult(resultFromRecord(record), false);
  }

  function editSavedRecord(recordId) {
    const record = recordsCache.find((item) => item.id === recordId);
    if (!record) return;
    editingRecordId = recordId;
    loadRecordIntoForm(record);
    $("save-case").textContent = "Update inspection";
    showRecordsAction(`Editing concern No. ${record.concernNo}. Change the evaluation path, click Evaluate CCP, then click Update inspection.`);
    $("evaluation-path-section").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function removeSavedRecord(recordId) {
    const record = recordsCache.find((item) => item.id === recordId);
    if (!record) return;
    const confirmed = window.confirm(`Remove saved inspection No. ${record.concernNo}? This cannot be undone.`);
    if (!confirmed) return;
    try {
      if (sharedRecordsEnabled && location.protocol.startsWith("http")) {
        const response = await fetch(`/api/records?id=${encodeURIComponent(recordId)}`, { method: "DELETE" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not remove shared record.");
        recordsCache = Array.isArray(data.records) ? data.records : recordsCache.filter((item) => item.id !== recordId);
      } else {
        recordsCache = getLocalRecords().filter((item) => item.id !== recordId);
        setLocalRecords(recordsCache);
      }
      renderRecords();
      showRecordsAction(`Concern No. ${record.concernNo} removed.`);
    } catch (error) {
      showRecordsAction(error.message);
    }
  }

  async function loadRecords() {
    if (!location.protocol.startsWith("http")) {
      recordsCache = getLocalRecords();
      setRecordStorageStatus(false, "Records are stored in this browser because the system is opened as a local file. Open through the server/Azure link for shared storage.");
      renderRecords();
      return;
    }
    try {
      const response = await fetch("/api/records", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load saved records.");
      recordsCache = Array.isArray(data.records) ? data.records : [];
      setRecordStorageStatus(true, "Records are stored by the system backend and can be seen by users opening the same server/Azure system. Evidence photos are compressed and stored with the inspection for Excel report export.");
    } catch (error) {
      recordsCache = getLocalRecords();
      setRecordStorageStatus(false, `Shared storage is unavailable, so this browser is using local storage only. ${error.message}`);
    }
    renderRecords();
  }

  async function clearSavedInspections() {
    const confirmed = window.confirm("Remove all saved inspections and reset sessions back to Session 1? This cannot be undone.");
    if (!confirmed) return;

    if (sharedRecordsEnabled && location.protocol.startsWith("http")) {
      try {
        const response = await fetch("/api/records", { method: "DELETE" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not clear shared records.");
        recordsCache = [];
      } catch (error) {
        showRecordsAction(`Could not clear shared storage: ${error.message}`);
        return;
      }
    } else {
      recordsCache = [];
    }

    localStorage.removeItem(recordsKey);
    localStorage.removeItem(sessionKey);
    localStorage.removeItem(sessionCounterKey);
    initSession(true);
    resetCase();
    renderRecords();
    showRecordsAction("All saved inspections were removed. Session reset to Session 1.");
  }

  function selectedText(id) {
    return $(id).selectedOptions[0]?.textContent || "";
  }

  function selectedRoutingType() {
    return $("routing-type").value === "__custom__" ? $("custom-routing-type").value.trim() : $("routing-type").value;
  }

  function selectedSystem() {
    return $("routing-system").value === "__custom__" ? $("custom-system").value.trim() : $("routing-system").value;
  }

  function selectedPcwTypeForRules() {
    return pcwTypeValueFromRoutingType(currentRoutingType()) || "other";
  }

  function selectedPcwTypeLabel() {
    const labels = {
      electric_cable: "Electric cable / wiring",
      rubber_hose: "Rubber hose",
      plastic_tube: "Plastic tube",
      metal_tube: "Metal tube",
      other: "Other"
    };
    return labels[selectedPcwTypeForRules()] || "Other";
  }

  function currentRoutingType() {
    return selectedRoutingType();
  }

  function defaultDetailFor(record, result) {
    const observation = record.observation ? `Detail: ${record.observation}` : "Detail: -";
    return `${record.type} concern. ${observation}. Initial grade ${result.initialGrade}; final grade ${result.finalGrade}. ${result.rules.join(" ")}`;
  }

  async function saveCase() {
    if (!currentResult) return;
    if (!currentSession) initSession();
    const existingRecord = editingRecordId ? recordsCache.find((item) => item.id === editingRecordId) : null;
    const isEditing = Boolean(existingRecord);
    const concernNo = isEditing ? existingRecord.concernNo : Number(currentSession.nextConcernNo) || 1;
    let photoDataList = [];
    try {
      photoDataList = await compressedPhotoDataList();
    } catch (error) {
      showRecordsAction(`${error.message} The inspection will be saved without the embedded photo.`);
    }
    if (isEditing && !photoDataList.length) {
      photoDataList = Array.isArray(existingRecord.photoDataList) ? existingRecord.photoDataList : (existingRecord.photoData ? [existingRecord.photoData] : []);
    }
    const record = {
      ...(existingRecord || {}),
      id: isEditing ? existingRecord.id : (crypto.randomUUID ? crypto.randomUUID() : String(Date.now())),
      sessionId: isEditing ? existingRecord.sessionId : currentSession.id,
      sessionNo: isEditing ? existingRecord.sessionNo : currentSession.number,
      sessionLabel: isEditing ? existingRecord.sessionLabel : sessionLabel(),
      concernNo,
      ...caseMetadata(), type: currentResult.type, initialGrade: currentResult.initialGrade, grade: currentResult.finalGrade,
      photoData: photoDataList[0] || "",
      photoDataList,
      risk: currentResult.risk.label, decisionTrail: currentResult.rules.join(" | "), actions: currentResult.actions.join(" | "),
      powertrain: $("powertrain").value,
      system: selectedSystem(),
      routingType: currentRoutingType(),
      pcwType: currentResult.type === "contact" ? selectedPcwTypeLabel() : "",
      clearanceMiniAcceptable: existingRecord?.clearanceMiniAcceptable || "",
      defectArea: existingRecord?.defectArea || "",
      defectAreaImageData: await defectAreaImageData(),
      status: statusForGrade(currentResult.finalGrade),
      alignedComment: existingRecord?.alignedComment || "",
      lpmComment: existingRecord?.lpmComment || "",
      evaluationSnapshot: currentEvaluationSnapshot(),
      savedAt: existingRecord?.savedAt || new Date().toISOString(),
      updatedAt: isEditing ? new Date().toISOString() : ""
    };
    record.reportDefaultDetail = defaultDetailFor(record, currentResult);
    $("save-case").disabled = true;
    if (isEditing) {
      try {
        await replaceSavedRecord(record);
      } catch (error) {
        showRecordsAction(error.message);
        $("save-case").disabled = false;
        return;
      }
    } else if (sharedRecordsEnabled) {
      try {
        const response = await fetch("/api/records", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ record })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not save to shared storage.");
        recordsCache = Array.isArray(data.records) ? data.records : [...recordsCache, data.record];
      } catch (error) {
        recordsCache = [...getLocalRecords(), record];
        setLocalRecords(recordsCache);
        setRecordStorageStatus(false, `Shared save failed, so this record was saved in this browser only. ${error.message}`);
      }
    } else {
      recordsCache = [...getLocalRecords(), record];
      setLocalRecords(recordsCache);
    }
    if (!isEditing) advanceSessionCounter();
    renderRecords();
    $("save-case").textContent = isEditing ? "Updated" : "Saved";
    const sessionCount = currentSessionRows().length;
    showRecordsAction(isEditing
      ? `Updated ${record.sessionLabel || sessionLabel()} concern No. ${concernNo}.`
      : `Saved as ${sessionLabel()} concern No. ${concernNo}. This session now has ${sessionCount} saved inspection${sessionCount === 1 ? "" : "s"}.`);
    setTimeout(() => {
      editingRecordId = "";
      $("save-case").textContent = "Save inspection";
      $("save-case").disabled = false;
      resetEvaluationPath();
    }, 1200);
  }

  function csvValue(value) {
    return `"${String(value ?? "").replaceAll('"', '""')}"`;
  }

  function htmlCell(value) {
    return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
  }

  function photoReportCell(row, includeImages = true) {
    const images = Array.isArray(row.photoDataList) && row.photoDataList.length ? row.photoDataList : (row.photoData ? [row.photoData] : []);
    if (includeImages && images.length) return { images, name: row.photo || "Evidence photo" };
    return row.photo || (images.length ? "Evidence photo saved - use localhost export to embed" : "");
  }

  function defectAreaReportCell(row, includeImages = true) {
    const image = row.defectAreaImageData || "";
    if (includeImages && image.startsWith("data:image/")) return { images: [image], name: "Defect area marker" };
    return row.defectArea || (image ? "Defect area marker saved - use localhost export to embed" : "");
  }

  function statusForGrade(grade) {
    const normalized = String(grade || "").trim().toUpperCase().replace(/[\s-]+/g, " ");
    if (["NO GRADE", "NOGRADE", "NA", "N/A"].includes(normalized)) return "NA";
    if (["S", "A", "B", "C"].includes(normalized)) return "OK";
    return "";
  }

  function reportExportMetadata(rows) {
    const sortedRows = rows.slice().sort((a, b) => Number(a.concernNo || 0) - Number(b.concernNo || 0));
    const first = sortedRows.find((row) => row.inspector || row.date) || sortedRows[0] || {};
    const inspector = first.inspector || $("inspector").value.trim() || "";
    const inspectionDate = first.date || $("date").value || new Date().toISOString().slice(0, 10);
    const exportTime = new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
    return {
      name: `Name : ${inspector}`.trim(),
      dateTime: `Date & Time : ${inspectionDate} ${exportTime}`.trim()
    };
  }

  function reportMetadataRows(rows) {
    const metadata = reportExportMetadata(rows);
    return `<tbody class="report-meta"><tr class="meta-row"><td colspan="9">${htmlCell(metadata.name)}</td><td></td><td colspan="2">${htmlCell(metadata.dateTime)}</td><td colspan="2"></td></tr></tbody>`;
  }

  function dataUrlImagePart(dataUrl, index) {
    const match = String(dataUrl || "").match(/^data:(image\/(?:png|jpeg|jpg|gif));base64,(.+)$/);
    if (!match) return null;
    const mime = match[1].replace("image/jpg", "image/jpeg");
    const extension = mime === "image/png" ? "png" : mime === "image/gif" ? "gif" : "jpg";
    return { location: `photo-${index}.${extension}`, mime, base64: match[2] };
  }

  function reportHtmlCell(cell, imageParts) {
    if (cell && typeof cell === "object" && Array.isArray(cell.images)) {
      const imgs = cell.images.map((image) => {
        const part = imageParts ? dataUrlImagePart(image, imageParts.length) : null;
        if (part) {
          imageParts.push(part);
          return `<img src="${part.location}" alt="${htmlCell(cell.name)}">`;
        }
        return "";
      }).filter(Boolean).join("");
      return `<td class="photo-cell">${imgs || htmlCell(cell.name)}</td>`;
    }
    return `<td>${htmlCell(cell)}</td>`;
  }

  function wrapBase64(value) {
    return String(value).replace(/.{1,76}/g, "$&\r\n").trim();
  }

  function mhtmlReport(html, imageParts) {
    const boundary = "----=_CCP_ROUTING_REPORT";
    const imageSections = imageParts.map((part) => [
      `--${boundary}`,
      `Content-Type: ${part.mime}`,
      "Content-Transfer-Encoding: base64",
      `Content-Location: ${part.location}`,
      "",
      wrapBase64(part.base64)
    ].join("\r\n")).join("\r\n");
    return [
      "MIME-Version: 1.0",
      `Content-Type: multipart/related; boundary="${boundary}"; type="text/html"`,
      "",
      `--${boundary}`,
      'Content-Type: text/html; charset="utf-8"',
      "Content-Location: report.htm",
      "",
      html,
      imageSections,
      `--${boundary}--`
    ].filter(Boolean).join("\r\n");
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  function exportCsv() {
    const rows = currentSessionRows();
    if (!rows.length) {
      showRecordsAction("No saved inspections in this session to export. First evaluate a case, then click Save inspection.");
      return;
    }
    const headers = [
      "SL NO", "Index Number\nN° fiche", "Perimeter or Project Impacted\nPérimètre ou Projet Im", "Area\nZone",
      "Powertrain or Function\nGMP OU Fonc", "System", "Routing type\nType parcours", "Default detail\nLibellé du défaut",
      "Clearance mini acceptable + put the source of the value in DT",
      "Defect Area\nZone du défaut", "Photos", "VEHE Comment", "Status", "Judgment"
    ];
    const reportRows = rows.slice().sort((a, b) => Number(a.concernNo || 0) - Number(b.concernNo || 0)).map((row, index) => [
      row.concernNo || index + 1,
      indexNumber(row),
      row.vehicle,
      row.zone ? `Zone ${row.zone}` : "",
      row.powertrain || "",
      row.system || "",
      row.routingType || "",
      row.observation || "",
      row.clearanceMiniAcceptable || "",
      defectAreaReportCell(row, false),
      photoReportCell(row, false),
      row.alignedComment || "",
      statusForGrade(row.grade) || row.status || "",
      row.grade || ""
    ]);
    const imageParts = [];
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>
      table{border-collapse:collapse;font-family:Arial,sans-serif;font-size:10pt}
      th,td{border:1px solid #7f8fa6;padding:6px;vertical-align:middle;white-space:normal}
      th{background:#b7cce3;font-weight:bold;text-align:center}
      th:nth-child(2),th:nth-child(8),th:nth-child(10){background:#d8d0e8}
      th:nth-child(9){background:#fff2cc}
      th:nth-child(14){background:#f4c7c3}
      tr{height:150px}
      thead tr{height:auto}
      .photo-cell{display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:center;overflow:hidden}
      .photo-cell img{display:block;max-width:170px;max-height:120px;object-fit:contain}
      .report-meta td{background:#fff;font-weight:bold;height:30px}
      td{text-align:left}
      td:first-child{text-align:center}
    </style></head><body><table>${reportMetadataRows(rows)}<thead><tr>${headers.map((header) => `<th>${htmlCell(header).replaceAll("\n", "<br>")}</th>`).join("")}</tr></thead><tbody>${reportRows.map((row) => `<tr>${row.map((cell) => reportHtmlCell(cell, imageParts)).join("")}</tr>`).join("")}</tbody></table></body></html>`;
    const content = imageParts.length ? mhtmlReport(html, imageParts) : html;
    const url = URL.createObjectURL(new Blob([content], { type: "application/vnd.ms-excel;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `ccp-report-${currentSession.id}.xls`;
    link.click();
    URL.revokeObjectURL(url);
    showRecordsAction(`Excel report downloaded with ${rows.length} concern${rows.length === 1 ? "" : "s"} from this session. Check your Downloads folder.`);
  }

  async function downloadTemplateReport(rows) {
    if (!location.protocol.startsWith("http") || !sharedRecordsEnabled || !currentSession?.id) return false;
    const params = new URLSearchParams({ sessionId: currentSession.id, label: sessionLabel(), t: String(Date.now()) });
    const link = document.createElement("a");
    link.href = `/api/export-template?${params.toString()}`;
    link.download = `ccp-report-${sessionLabel().toLowerCase().replaceAll(" ", "-")}.xlsm`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    showRecordsAction(`Excel report download started for ${sessionLabel()} with ${rows.length} concern${rows.length === 1 ? "" : "s"}. Check Downloads/Files.`);
    return true;
  }

  async function exportExcelReport() {
    const rows = currentSessionRows();
    if (!rows.length) {
      showRecordsAction("No saved inspections in this session to export. First evaluate a case, then click Save inspection.");
      return;
    }
    if (await downloadTemplateReport(rows)) return;
    const headers = [
      "SL NO", "Index Number\nN° fiche", "Perimeter or Project Impacted\nPérimètre ou Projet Im", "Area\nZone",
      "Powertrain or Function\nGMP OU Fonc", "System", "Routing type\nType parcours", "Default detail\nLibellé du défaut",
      "Clearance mini acceptable + put the source of the value in DT",
      "Defect Area\nZone du défaut", "Photos", "VEHE Comment", "Status", "Judgment"
    ];
    const reportRows = rows.slice().sort((a, b) => Number(a.concernNo || 0) - Number(b.concernNo || 0)).map((row, index) => [
      row.concernNo || index + 1,
      indexNumber(row),
      row.vehicle,
      row.zone ? `Zone ${row.zone}` : "",
      row.powertrain || "",
      row.system || "",
      row.routingType || "",
      row.observation || "",
      row.clearanceMiniAcceptable || "",
      defectAreaReportCell(row, false),
      photoReportCell(row, false),
      row.alignedComment || "",
      statusForGrade(row.grade) || row.status || "",
      row.grade || ""
    ]);
    const columnWidths = [8, 13, 25, 13, 18, 18, 18, 38, 36, 22, 42, 28, 14, 14];
    const imageParts = [];
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>
      table{border-collapse:collapse;font-family:Arial,sans-serif;font-size:10pt;table-layout:fixed}
      col{mso-width-source:userset}
      th,td{border:1px solid #7f8fa6;padding:6px;vertical-align:middle;white-space:normal;mso-number-format:"\\@";height:24px}
      th{background:#b7cce3;font-weight:bold;text-align:center;color:#000;height:58px}
      th:nth-child(2),th:nth-child(8),th:nth-child(10){background:#d8d0e8}
      th:nth-child(9){background:#fff2cc}
      th:nth-child(14){background:#f4c7c3}
      tr{height:150px}
      thead tr{height:auto}
      .photo-cell{display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:center;overflow:hidden}
      .photo-cell img{display:block;max-width:170px;max-height:120px;object-fit:contain}
      .report-meta td{background:#fff;font-weight:bold;height:30px}
      td{text-align:left}
      td:first-child{text-align:center}
    </style></head><body><table><colgroup>${columnWidths.map((width) => `<col style="width:${width}ch">`).join("")}</colgroup>${reportMetadataRows(rows)}<thead><tr>${headers.map((header) => `<th>${htmlCell(header).replaceAll("\n", "<br>")}</th>`).join("")}</tr></thead><tbody>${reportRows.map((row) => `<tr>${row.map((cell) => reportHtmlCell(cell, imageParts)).join("")}</tr>`).join("")}</tbody></table></body></html>`;
    const content = imageParts.length ? mhtmlReport(html, imageParts) : html;
    downloadBlob(new Blob([content], { type: "application/vnd.ms-excel;charset=utf-8" }), `ccp-report-${sessionLabel().toLowerCase().replaceAll(" ", "-")}.xls`);
    const hasPhotos = rows.some((row) => row.photoData || (Array.isArray(row.photoDataList) && row.photoDataList.length));
    showRecordsAction(hasPhotos
      ? `Excel report downloaded without embedded photos from local index.html. Use http://localhost:8080/ export for photos inside cells.`
      : `Excel report downloaded for ${sessionLabel()} with ${rows.length} concern${rows.length === 1 ? "" : "s"}. Check your Downloads folder.`);
  }

  function resetEvaluationPath() {
    document.querySelectorAll('input[name="type"]').forEach((input) => { input.checked = false; });
    document.querySelectorAll("#common-fields select, #common-fields input, #contact-fields select, #contact-fields input, #proximity-fields select, #proximity-fields input, #heat-fields select, #heat-fields input").forEach((field) => {
      if (field.type === "checkbox") field.checked = false;
      else field.value = "";
    });
    $("result").classList.add("hidden");
    $("form-error").classList.add("hidden");
    currentResult = null;
    updateRoutingTypeOptions();
    updateConditionalFields();
  }

  function startNewEvaluate() {
    editingRecordId = "";
    $("save-case").textContent = "Save inspection";
    $("save-case").disabled = false;
    resetEvaluationPath();
  }

  function resetCase() {
    editingRecordId = "";
    $("save-case").textContent = "Save inspection";
    $("save-case").disabled = false;
    $("evaluation-form").reset();
    $("date").value = new Date().toISOString().slice(0, 10);
    resetDefectMarkers();
    resetEvaluationPath();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  $("evaluation-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const metadata = caseMetadata();
    if (!metadata.vehicle) {
      $("form-error").textContent = "Vehicle/project is required.";
      $("form-error").classList.remove("hidden");
      return;
    }
    const type = selectedType();
    const missing = validateEvaluation(type);
    if (missing.length) {
      $("form-error").textContent = `Please choose or enter: ${missing.join(", ")}.`;
      $("form-error").classList.remove("hidden");
      return;
    }
    try {
      const result = CCP.evaluate(type, collectInput(type));
      $("form-error").classList.add("hidden");
      showResult(result);
    } catch (error) {
      $("form-error").textContent = error.message;
      $("form-error").classList.remove("hidden");
    }
  });
  function handleFormModification(event) {
    if (currentResult) {
      const metadataOnly = new Set(["vehicle", "zone", "inspector", "date", "observation", "photo"]);
      if (editingRecordId && metadataOnly.has(event.target.id)) return;
      currentResult = null;
      $("result").classList.add("hidden");
    }
  }
  $("evaluation-form").addEventListener("input", handleFormModification);
  $("evaluation-form").addEventListener("change", handleFormModification);

  document.querySelectorAll('input[name="type"]').forEach((radio) => radio.addEventListener("change", updateConditionalFields));
  $("routing-system").addEventListener("change", updateRoutingTypeOptions);
  $("routing-type").addEventListener("change", updateCustomRoutingField);
  $("safety").addEventListener("change", updateSelectedDefinitions);
  $("movement").addEventListener("change", updateSelectedDefinitions);
  $("contact-surface").addEventListener("change", updateSelectedDefinitions);
  $("contact-material").addEventListener("change", () => normalizeSurfaceOptions("contact-material", "contact-surface"));
  $("proximity-material").addEventListener("change", () => normalizeSurfaceOptions("proximity-material", "proximity-surface"));
  $("two-proximity").addEventListener("change", () => $("secondary-proximity-wrap").classList.toggle("hidden", !checked("two-proximity")));
  $("save-case").addEventListener("click", saveCase);
  $("export-csv").addEventListener("click", exportExcelReport);
  $("clear-records").addEventListener("click", clearSavedInspections);
  $("new-session").addEventListener("click", startNewSession);
  $("new-case").addEventListener("click", startNewEvaluate);
  $("zone").addEventListener("change", updateZoneReference);
  $("assistant-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const question = $("assistant-input").value;
    $("assistant-input").value = "";
    askAssistant(question);
  });
  document.querySelectorAll("[data-assistant-prompt]").forEach((button) => button.addEventListener("click", () => askAssistant(button.dataset.assistantPrompt)));

  populateZones();
  updateZoneReference();
  $("date").value = new Date().toISOString().slice(0, 10);
  updateRoutingTypeOptions();
  normalizeSurfaceOptions("contact-material", "contact-surface");
  normalizeSurfaceOptions("proximity-material", "proximity-surface");
  updateConditionalFields();
  setupDefectAreaMarker();
  initSession();
  loadRecords();
  checkProfessionalAI();
  addAssistantMessage("ai", "Hello. I am your CCP Assistant. When the professional AI server is connected, I can answer open-ended questions. Otherwise I use the built-in offline CCP knowledge. The official rule engine remains responsible for grades.");
})();
