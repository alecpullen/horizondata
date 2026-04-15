import { useEffect } from 'react'

function Step2SelectTarget({
    targets,
    filters,
    setFilters,
    selectedTargets,
    setSelectedTargets,
    maxTargets,
    onApplyFilters,
    isLoading
}) {
    const isSelected = (target) => selectedTargets.some(t => t.id === target.id)

    const canAddMore = selectedTargets.length < maxTargets

    const handleTargetToggle = (target) => {
        if (isSelected(target)) {
            // Remove from selection
            setSelectedTargets(prev => prev.filter(t => t.id !== target.id))
        } else if (canAddMore) {
            // Add to selection
            setSelectedTargets(prev => [...prev, target])
        }
    }

    const handleRemoveTarget = (targetId) => {
        setSelectedTargets(prev => prev.filter(t => t.id !== targetId))
    }

    const handleMoveTarget = (index, direction) => {
        const newTargets = [...selectedTargets]
        const newIndex = index + direction
        if (newIndex >= 0 && newIndex < newTargets.length) {
            const temp = newTargets[index]
            newTargets[index] = newTargets[newIndex]
            newTargets[newIndex] = temp
            setSelectedTargets(newTargets)
        }
    }

    // Auto-apply filters when they change
    useEffect(() => {
        onApplyFilters()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filters.type, filters.search])

    return (
        <div className="step-2">
            <div className="target-selection-layout">
                {/* Left side: Target selection area */}
                <div className="target-selection-main">
                    {/* Header with filter and count */}
                    <div className="target-selection-header">
                        <div className="filter-bar filter-bar--compact">
                            <div className="filter-row filter-row--compact">
                                <div className="filter-group">
                                    <select
                                        className="filter-select"
                                        value={filters.type}
                                        onChange={(e) => setFilters({ ...filters, type: e.target.value })}
                                    >
                                        <option value="all">All Objects</option>
                                        <option value="Planet">Planets</option>
                                        <option value="Star">Stars</option>
                                        <option value="Nebula">Nebulae</option>
                                        <option value="Galaxy">Galaxies</option>
                                        <option value="Cluster">Star Clusters</option>
                                    </select>
                                </div>

                                <div className="filter-group filter-group--search">
                                    <input
                                        type="text"
                                        className="filter-input"
                                        placeholder="Search targets..."
                                        value={filters.search}
                                        onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="target-selection-counter">
                            <span className="target-count-badge">
                                {selectedTargets.length}/{maxTargets}
                            </span>
                            <span className="target-count-hint">targets</span>
                        </div>
                    </div>

                    {/* Target List */}
                    <div className="target-list-container">
                        {isLoading ? (
                            <div className="targets-loading">
                                <div className="targets-loading__spinner" />
                                <p>Loading targets...</p>
                            </div>
                        ) : targets.length === 0 ? (
                            <div className="targets-empty">
                                <div className="targets-empty__icon">
                                    <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.5">
                                        <circle cx="12" cy="12" r="10" />
                                        <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
                                        <path d="M2 12h20" />
                                    </svg>
                                </div>
                                <h3>No targets found</h3>
                                <p>Try adjusting your filters or search query</p>
                            </div>
                        ) : (
                            <table className="target-table">
                                <thead>
                                    <tr>
                                        <th className="col-num">#</th>
                                        <th>Target Name</th>
                                        <th>Type</th>
                                        <th>At Session Time</th>
                                        <th>Mag</th>
                                        <th className="col-action">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {targets.map((target) => {
                                        const selected = isSelected(target)
                                        const selectionIndex = selectedTargets.findIndex(t => t.id === target.id)

                                        return (
                                            <tr
                                                key={target.id}
                                                className={selected ? 'target-row--selected' : ''}
                                            >
                                                <td className="col-num">
                                                    {selected && (
                                                        <span className="target-selection-indicator">
                                                            {selectionIndex + 1}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="target-name">
                                                    <div className="target-name-main">{target.name}</div>
                                                    {target.catalog && (
                                                        <div className="target-name-catalog">{target.catalog}</div>
                                                    )}
                                                </td>
                                                <td className="target-type">
                                                    <span className={`type-badge type-badge--${(target.type || 'unknown').toLowerCase().replace(/\s+.*$/, '')}`}>
                                                        {target.type || 'Unknown'}
                                                    </span>
                                                </td>
                                                <td className="target-quality">
                                                    <div className={`quality-elevation quality-elevation--${target.quality}`}>
                                                        {target.trend?.direction} {target.altitude}
                                                    </div>
                                                    <div className="quality-label" title={target.trend?.label}>
                                                        {target.trend?.label === 'Highest point' ? `● Transit ${target.transitTime}` : target.trend?.label}
                                                    </div>
                                                </td>
                                                <td className="target-magnitude">
                                                    {target.magnitude !== null && target.magnitude !== undefined ? (
                                                        <span className={`mag-value mag-value--${target.magnitude < 4 ? 'bright' : target.magnitude < 8 ? 'medium' : 'dim'}`}>
                                                            {target.magnitude.toFixed(1)}
                                                        </span>
                                                    ) : (
                                                        <span className="mag-value mag-value--unknown">—</span>
                                                    )}
                                                </td>
                                                <td className="col-action">
                                                    <button
                                                        className={`target-select-btn ${selected ? 'target-select-btn--selected' : ''}`}
                                                        onClick={() => handleTargetToggle(target)}
                                                        disabled={!selected && !canAddMore}
                                                        title={selected ? 'Click to remove' : canAddMore ? 'Click to add' : 'Maximum targets reached'}
                                                    >
                                                        {selected ? (
                                                            <>
                                                                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="3">
                                                                    <polyline points="20 6 9 17 4 12" />
                                                                </svg>
                                                                Added
                                                            </>
                                                        ) : !canAddMore ? (
                                                            <>
                                                                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                                                                    <line x1="12" y1="5" x2="12" y2="19" />
                                                                </svg>
                                                                Full
                                                            </>
                                                        ) : (
                                                            <>
                                                                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                                                                    <line x1="12" y1="5" x2="12" y2="19" />
                                                                    <line x1="5" y1="12" x2="19" y2="12" />
                                                                </svg>
                                                                Add
                                                            </>
                                                        )}
                                                    </button>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>

                {/* Right side: Compact queue panel */}
                <div className="target-queue-panel">
                    <div className="target-queue-header">
                        <span className="target-queue-title">Queue</span>
                        <span className="target-queue-time">{selectedTargets.length * 5} min</span>
                    </div>

                    {selectedTargets.length === 0 ? (
                        <div className="target-queue-empty">
                            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                            </svg>
                            <span>Select targets</span>
                        </div>
                    ) : (
                        <div className="target-queue-list">
                            {selectedTargets.map((target, index) => (
                                <div key={target.id} className="target-queue-item">
                                    <span className="queue-item-num">{index + 1}</span>
                                    <div className="queue-item-info">
                                        <span className="queue-item-name" title={target.name}>
                                            {target.name}
                                        </span>
                                        <span className={`queue-item-type type-badge type-badge--${(target.type || 'unknown').toLowerCase().replace(/\s+.*$/, '')}`}>
                                            {target.type || '?'}
                                        </span>
                                    </div>
                                    <div className="queue-item-actions">
                                        <button
                                            className="queue-move-btn"
                                            onClick={() => handleMoveTarget(index, -1)}
                                            disabled={index === 0}
                                            title="Move up"
                                        >
                                            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2">
                                                <polyline points="18 15 12 9 6 15" />
                                            </svg>
                                        </button>
                                        <button
                                            className="queue-move-btn"
                                            onClick={() => handleMoveTarget(index, 1)}
                                            disabled={index === selectedTargets.length - 1}
                                            title="Move down"
                                        >
                                            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2">
                                                <polyline points="6 9 12 15 18 9" />
                                            </svg>
                                        </button>
                                        <button
                                            className="queue-remove-btn"
                                            onClick={() => handleRemoveTarget(target.id)}
                                            title="Remove"
                                        >
                                            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2">
                                                <line x1="18" y1="6" x2="6" y2="18" />
                                                <line x1="6" y1="6" x2="18" y2="18" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {selectedTargets.length > 0 && (
                        <button
                            className="queue-clear-btn"
                            onClick={() => setSelectedTargets([])}
                        >
                            Clear queue
                        </button>
                    )}
                </div>
            </div>

            {/* Target Details Panel - Shows last selected target */}
            {selectedTargets.length > 0 && (
                <div className="target-details-panel">
                    <div className="target-details-header">
                        <h3 className="target-details-title">{selectedTargets[selectedTargets.length - 1].name}</h3>
                        <span className={`type-badge type-badge--${(selectedTargets[selectedTargets.length - 1].type || 'unknown').toLowerCase().replace(/\s+.*$/, '')}`}>
                            {selectedTargets[selectedTargets.length - 1].type || 'Unknown'}
                        </span>
                    </div>

                    <div className="target-details-content">
                        <div className="target-details-grid">
                            <div className="detail-item">
                                <span className="detail-label">Constellation</span>
                                <span className="detail-value">{selectedTargets[selectedTargets.length - 1].constellation || 'Unknown'}</span>
                            </div>
                            <div className="detail-item">
                                <span className="detail-label">Magnitude</span>
                                <span className="detail-value">{selectedTargets[selectedTargets.length - 1].magnitude?.toFixed(2) || 'N/A'}</span>
                            </div>
                            <div className="detail-item">
                                <span className="detail-label">At Session Start</span>
                                <span className={`detail-value quality-text--${selectedTargets[selectedTargets.length - 1].quality}`}>
                                    {selectedTargets[selectedTargets.length - 1].trend?.direction} {selectedTargets[selectedTargets.length - 1].altitude}
                                </span>
                            </div>
                            <div className="detail-item">
                                <span className="detail-label">Transit Time</span>
                                <span className="detail-value">{selectedTargets[selectedTargets.length - 1].transitTime || '—'}</span>
                            </div>
                            <div className="detail-item">
                                <span className="detail-label">Right Ascension</span>
                                <span className="detail-value">{selectedTargets[selectedTargets.length - 1].ra || selectedTargets[selectedTargets.length - 1].rightAscension || 'N/A'}</span>
                            </div>
                            <div className="detail-item">
                                <span className="detail-label">Declination</span>
                                <span className="detail-value">{selectedTargets[selectedTargets.length - 1].dec || selectedTargets[selectedTargets.length - 1].declination || 'N/A'}</span>
                            </div>
                        </div>

                        {selectedTargets[selectedTargets.length - 1].description && (
                            <p className="target-description">{selectedTargets[selectedTargets.length - 1].description}</p>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}

export default Step2SelectTarget
