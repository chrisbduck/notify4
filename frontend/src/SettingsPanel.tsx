import { PersistedPanel } from './PersistedPanel';

const SETTINGS_PANEL_STORAGE_KEY = 'notify4SettingsPanelExpanded';

export function SettingsPanel({ showLowerPriorityDriveAlerts, onToggleShowLowerPriorityDriveAlerts }: { showLowerPriorityDriveAlerts: boolean; onToggleShowLowerPriorityDriveAlerts: () => void }) {
    return (
        <PersistedPanel title="Settings" storageKey={SETTINGS_PANEL_STORAGE_KEY}>
            <div className="settings-panel-content">
                <label className="settings-toggle-row">
                    <input
                        type="checkbox"
                        checked={showLowerPriorityDriveAlerts}
                        onChange={onToggleShowLowerPriorityDriveAlerts}
                    />
                    <span>Show lower-priority drive alerts</span>
                </label>
            </div>
        </PersistedPanel>
    );
}
