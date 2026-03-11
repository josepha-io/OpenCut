import { useEditor } from "@/hooks/use-editor";
import { NumberField } from "@/components/ui/number-field";
import { Button } from "@/components/ui/button";
import { clamp } from "@/utils/math";
import {
	Section,
	SectionContent,
	SectionField,
	SectionHeader,
	SectionTitle,
} from "../section";
import type { VideoElement } from "@/types/timeline";
import { HugeiconsIcon } from "@hugeicons/react";
import { DashboardSpeed01Icon } from "@hugeicons/core-free-icons";
import { useState } from "react";

const SPEED_PRESETS = [0.5, 1, 1.5, 2] as const;

export function SpeedSection({
	element,
	trackId,
}: {
	element: VideoElement;
	trackId: string;
}) {
	const editor = useEditor();
	const currentSpeed = element.playbackSpeed ?? 1;
	const sourceDuration = element.sourceDuration ?? element.duration;
	const [displayValue, setDisplayValue] = useState(
		(currentSpeed * 100).toFixed(0),
	);

	// Keep display in sync when element changes externally
	const expectedDisplay = (currentSpeed * 100).toFixed(0);
	if (displayValue !== expectedDisplay && document.activeElement?.tagName !== "INPUT") {
		setDisplayValue(expectedDisplay);
	}

	const commitSpeed = (newSpeed: number) => {
		const speed = clamp({ value: newSpeed, min: 0.5, max: 2 });
		const trimmedSourceDuration =
			sourceDuration - element.trimStart - element.trimEnd;
		const newDuration = trimmedSourceDuration / speed;

		editor.timeline.updateElements({
			updates: [
				{
					trackId,
					elementId: element.id,
					updates: {
						playbackSpeed: speed,
						duration: newDuration,
					},
				},
			],
		});
		setDisplayValue((speed * 100).toFixed(0));
	};

	return (
		<Section collapsible sectionKey="video:speed">
			<SectionHeader>
				<SectionTitle>Speed</SectionTitle>
			</SectionHeader>
			<SectionContent>
				<div className="flex flex-col gap-3">
					<SectionField label="Playback speed">
						<NumberField
							className="w-full"
							icon={
								<HugeiconsIcon
									icon={DashboardSpeed01Icon}
									className="size-3.5 text-muted-foreground"
								/>
							}
							value={displayValue}
							min={50}
							max={200}
							onChange={(e) => setDisplayValue(e.target.value)}
							onBlur={(e) => {
								const parsed = Number.parseFloat(e.target.value);
								if (!Number.isNaN(parsed)) {
									commitSpeed(
										clamp({ value: parsed / 100, min: 0.5, max: 2 }),
									);
								} else {
									setDisplayValue(expectedDisplay);
								}
							}}
							onScrub={(value) => {
								const clamped = clamp({ value, min: 50, max: 200 });
								setDisplayValue(clamped.toFixed(0));
							}}
							onScrubEnd={() => {
								const parsed = Number.parseFloat(displayValue);
								if (!Number.isNaN(parsed)) {
									commitSpeed(parsed / 100);
								}
							}}
							onReset={() => commitSpeed(1)}
							isDefault={currentSpeed === 1}
							dragSensitivity="slow"
						/>
					</SectionField>
					<div className="flex gap-1.5">
						{SPEED_PRESETS.map((preset) => (
							<Button
								key={preset}
								variant={currentSpeed === preset ? "default" : "outline"}
								size="sm"
								className="flex-1 text-xs"
								onClick={() => commitSpeed(preset)}
							>
								{preset}x
							</Button>
						))}
					</div>
				</div>
			</SectionContent>
		</Section>
	);
}
