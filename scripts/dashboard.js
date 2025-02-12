document.addEventListener("DOMContentLoaded", function () {
    console.debug("[Dashboard] Loading assignments...");

    const assignmentsDiv = document.getElementById("assignments");
    const refreshButton = document.getElementById("refresh");
    const dashboardButton = document.getElementById("dashboard");
	let oldAssignmentCount = 0;

	// Build the assignments
	function displayAssignments(groupedAssignments, container) {
		container.innerHTML = "";
		if (!groupedAssignments || groupedAssignments.length === 0) {
			container.innerHTML = "<p>No assignments found.</p>";
			return;
		}

		// Normalize today's and tomorrow's date.
		const today = new Date();
		today.setHours(0, 0, 0, 0);
		const todayStr = today.toISOString().split("T")[0];

		const tomorrow = new Date(today);
		tomorrow.setDate(tomorrow.getDate() + 1);
		const tomorrowStr = tomorrow.toISOString().split("T")[0];

		let oldAssignmentCount = 0;

		// Loop through each day group.
		groupedAssignments.forEach(dayGroup => {
			// Create a Date object from the stored "date" string.
			// Add a day cause, um idk
			const dayDate = new Date(new Date(dayGroup.date).setHours(0, 0, 0, 0) + 86400000);

			// Create the day header.
			let dayHeader;
			if (dayGroup.date === todayStr) {
				dayHeader = document.createElement("h2");
				dayHeader.textContent = "Today, " + dayDate.toLocaleDateString();
			} else if (dayGroup.date === tomorrowStr) {
				dayHeader = document.createElement("h3");
				dayHeader.textContent = "Tomorrow, " + dayDate.toLocaleDateString();
			} else {
				dayHeader = document.createElement("h3");
				dayHeader.textContent =
					dayDate.toLocaleDateString(undefined, { weekday: "long" }) +
						", " +
						dayDate.toLocaleDateString();
			}

			// If the day is in the past, add an "old-assignment" class.
			if (dayDate < today) {
				dayHeader.classList.add("old-assignment");
				// Count all assignments in this day group.
				dayGroup.groups.forEach(classGroup => {
					oldAssignmentCount += classGroup.assignments.length;
				});
			}

			container.appendChild(dayHeader);

			// For each class group for this day:
			dayGroup.groups.forEach(classGroup => {
				// Create a container for this class group.
				const assignmentGroupDiv = document.createElement("div");
				assignmentGroupDiv.classList.add("assignment");

				// Check if the assignment group is old
				if (dayDate < today) {
					assignmentGroupDiv.classList.add("old-assignment");
				}

				// Create the "color" header for the class.
				const colorDiv = document.createElement("div");
				colorDiv.classList.add("color");
				colorDiv.style.backgroundColor = classGroup.color ? classGroup.color : "var(--red)";
				colorDiv.style.border = `1px solid ${classGroup.color ? classGroup.color : "var(--red)"}`;
				const classHeader = document.createElement("h4");
				classHeader.textContent = classGroup["class"];
				colorDiv.appendChild(classHeader);

				// Create the container for the assignment items.
				const groupDiv = document.createElement("div");
				groupDiv.classList.add("group");

				// Loop over assignments in this class group.
				classGroup.assignments.forEach(assignment => {
					const a = document.createElement("a");
					a.classList.add("item");
					a.href = assignment.link;
					a.target = "_blank";

					const icon = document.createElement("i");
					icon.classList.add("fa", assignment.complete ? "fa-check" : "fa-times", assignment.complete ? "complete" : "incomplete");
					const assignmentName = document.createTextNode(` ${assignment.name}`);
					const infoDiv = document.createElement("div");
					infoDiv.classList.add("info");
					const dueDateP = document.createElement("p");
					dueDateP.textContent = `Due: ${assignment.due_date}`;
					const sourceP = document.createElement("p");
					sourceP.textContent = assignment.source || "";
					infoDiv.appendChild(dueDateP);
					infoDiv.appendChild(sourceP);

					a.appendChild(icon);
					a.appendChild(assignmentName);
					a.appendChild(document.createElement("br"));
					a.appendChild(infoDiv);

					groupDiv.appendChild(a);
				});

				// Append the color header and group container to the assignment group.
				assignmentGroupDiv.appendChild(colorDiv);
				assignmentGroupDiv.appendChild(groupDiv);

				container.appendChild(assignmentGroupDiv);
			});
		});

		// Optionally, add a button to reveal past (old) assignments if any exist.
		if (oldAssignmentCount > 0) {
			const viewButton = document.createElement("button");
			viewButton.id = "view-old-assignments";
			viewButton.classList.add("assignment-button");
			viewButton.textContent = `view ${oldAssignmentCount} past assignments`;

			viewButton.addEventListener("click", function () {
				const oldElements = container.querySelectorAll(".old-assignment");
				oldElements.forEach(el => {
					el.style.display = "flex";
				});
				viewButton.remove();
			});

			container.insertBefore(viewButton, container.firstChild);
		}
	}

    // Load all assignments from extension storage
    browser.storage.local.get("allAssignments").then((data) => {
		if (data.allAssignments.length === 0) {
			console.debug("[Dashboard] No assignments to load");
		}
		displayAssignments(data.allAssignments, assignmentsDiv);
    }).catch((err) => {
        console.warn("[Dashboard] Error loading all assignments:", err);
    });

    // Refresh assignments on button click.
    refreshButton.addEventListener("click", () => {
        browser.runtime.sendMessage({ action: "refreshAssignments" })
			.catch(error => {
				console.warn("[Dashboard] ERROR with refresh button", error);
			});
    });

    // Update the UI if there is a change to the extension storage
    browser.storage.onChanged.addListener((changes, areaName) => {
        if (areaName === 'local') {
            if (changes.allAssignments) {
                displayAssignments(changes.allAssignments.newValue, assignmentsDiv);
            }
        }
    });

    const canvasStatus = document.getElementById("canvas-status");
    const gradescopeStatus = document.getElementById("gradescope-status");

	// Set initial status messages
	initialStatus(canvasStatus, "canvasAssignments");
	initialStatus(gradescopeStatus, "gradescopeAssignments");
	async function initialStatus(statusElement, storageLocation) {
		const assignments = await browser.storage.local.get(storageLocation);
		if (assignments[storageLocation].lastSuccessfulFetch) {
			updateStatus(statusElement, {status: "Updated", message: `Updated ${assignments[storageLocation].lastSuccessfulFetch}`});
		} else {
			updateStatus(statusElement, {status: "Question", message: "Requires refreshing"});
		}
	}

	// Update status (Refreshing/Updated/Error)
	function updateStatus(statusElement, message) {
		// Add a tooltip to the icon
		if (message.message) {
			statusElement.title = message.message;
		}
	
		// Update the status icon
		statusElement.className = "";
		statusElement.classList.add("fa-solid");
		if (message.status === "Refresh") { statusElement.classList.add("fa-ellipsis"); }
		else if (message.status === "Updated") { statusElement.classList.add("fa-check"); }
		else if (message.status === "Error") { statusElement.classList.add("fa-triangle-exclamation"); }
		else { statusElement.classList.add("fa-question"); }
	}

	// Get status messages
	browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
		if (message.action === "updateCanvasStatus" && message.status) {
			updateStatus(canvasStatus, message);
		}
		if (message.action === "updateGradescopeStatus" && message.status) {
			updateStatus(gradescopeStatus, message);
		}
	});
});
