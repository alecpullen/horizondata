function Step2SelectTarget({ targets, filters, setFilters, selectedTarget, setSelectedTarget, onApplyFilters, isLoading }) {
    const handleTargetSelect = (target) => {
        setSelectedTarget(target)
    }

    return (
        <div className="step-1">
            {/* Search/Filter Bar */}
            <div className="filter-bar">
                <div className="filter-row">
                    <div className="filter-group">
                        <label className="filter-label">Scope</label>
                        <select
                            className="filter-select"
                            value={filters.scope}
                            onChange={(e) => setFilters({ ...filters, scope: e.target.value })}
                        >
                            <option value="all">All Sky</option>
                            <option value="deep">Deep Space</option>
                            <option value="planetary">Planetary</option>
                            <option value="stellar">Stellar</option>
                        </select>
                    </div>

                    <div className="filter-group filter-group--checkbox">
                        <label className="filter-checkbox">
                            <input
                                type="checkbox"
                                checked={filters.visibleNow}
                                onChange={(e) => setFilters({ ...filters, visibleNow: e.target.checked })}
                            />
                            <span className="filter-checkmark" />
                            Visible Now
                        </label>
                    </div>

                    <div className="filter-group filter-group--range">
                        <label className="filter-label">
                            Magnitude: {filters.magnitude[0]} - {filters.magnitude[1]}
                        </label>
                        <div className="range-inputs">
                            <input
                                type="range"
                                min="0"
                                max="15"
                                value={filters.magnitude[0]}
                                onChange={(e) => setFilters({ ...filters, magnitude: [parseInt(e.target.value), filters.magnitude[1]] })}
                            />
                            <input
                                type="range"
                                min="0"
                                max="15"
                                value={filters.magnitude[1]}
                                onChange={(e) => setFilters({ ...filters, magnitude: [filters.magnitude[0], parseInt(e.target.value)] })}
                            />
                        </div>
                    </div>

                    <div className="filter-group filter-group--checkbox">
                        <label className="filter-checkbox">
                            <input
                                type="checkbox"
                                checked={filters.popular}
                                onChange={(e) => setFilters({ ...filters, popular: e.target.checked })}
                            />
                            <span className="filter-checkmark" />
                            Popular
                        </label>
                    </div>

                    <div className="filter-group filter-group--search">
                        <input
                            type="text"
                            className="filter-input"
                            placeholder="Search targets..."
                            value={filters.search}
                            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                            onKeyPress={(e) => e.key === 'Enter' && onApplyFilters()}
                        />
                    </div>

                    <button className="filter-apply-btn" onClick={onApplyFilters}>
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="11" cy="11" r="8" />
                            <path d="m21 21-4.35-4.35" />
                        </svg>
                        Search
                    </button>
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
                                <th>Target Name</th>
                                <th>Type</th>
                                <th>Best Time</th>
                                <th>Magnitude</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {targets.map((target) => (
                                <tr
                                    key={target.id}
                                    className={selectedTarget?.id === target.id ? 'target-row--selected' : ''}
                                    onClick={() => handleTargetSelect(target)}
                                >
                                    <td className="target-name">
                                        <div className="target-name-main">{target.name}</div>
                                        {target.catalog && (
                                            <div className="target-name-catalog">{target.catalog}</div>
                                        )}
                                    </td>
                                    <td className="target-type">
                                        <span className={`type-badge type-badge--${target.type?.toLowerCase() || 'unknown'}`}>
                                            {target.type || 'Unknown'}
                                        </span>
                                    </td>
                                    <td className="target-best-time">
                                        {target.bestTime || target.visibleAt || 'Varies'}
                                    </td>
                                    <td className="target-magnitude">
                                        {target.magnitude !== undefined ? (
                                            <span className={`mag-value mag-value--${target.magnitude < 4 ? 'bright' : target.magnitude < 8 ? 'medium' : 'dim'}`}>
                                                {target.magnitude.toFixed(1)}
                                            </span>
                                        ) : (
                                            <span className="mag-value mag-value--unknown">—</span>
                                        )}
                                    </td>
                                    <td className="target-action">
                                        <button
                                            className={`target-select-btn ${selectedTarget?.id === target.id ? 'target-select-btn--selected' : ''}`}
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                handleTargetSelect(target)
                                            }}
                                        >
                                            {selectedTarget?.id === target.id ? (
                                                <>
                                                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="3">
                                                        <polyline points="20 6 9 17 4 12" />
                                                    </svg>
                                                    Selected
                                                </>
                                            ) : (
                                                'Select'
                                            )}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Selected Target Details Panel */}
            {selectedTarget && (
                <div className="target-details-panel">
                    <div className="target-details-header">
                        <h3 className="target-details-title">{selectedTarget.name}</h3>
                        <span className={`type-badge type-badge--${selectedTarget.type?.toLowerCase() || 'unknown'}`}>
                            {selectedTarget.type || 'Unknown'}
                        </span>
                    </div>

                    <div className="target-details-content">
                        {selectedTarget.image && (
                            <div className="target-image">
                                <img src={selectedTarget.image} alt={selectedTarget.name} />
                            </div>
                        )}

                        <div className="target-details-grid">
                            <div className="detail-item">
                                <span className="detail-label">Constellation</span>
                                <span className="detail-value">{selectedTarget.constellation || 'Unknown'}</span>
                            </div>
                            <div className="detail-item">
                                <span className="detail-label">Magnitude</span>
                                <span className="detail-value">{selectedTarget.magnitude?.toFixed(2) || 'N/A'}</span>
                            </div>
                            <div className="detail-item">
                                <span className="detail-label">Right Ascension</span>
                                <span className="detail-value">{selectedTarget.ra || selectedTarget.rightAscension || 'N/A'}</span>
                            </div>
                            <div className="detail-item">
                                <span className="detail-label">Declination</span>
                                <span className="detail-value">{selectedTarget.dec || selectedTarget.declination || 'N/A'}</span>
                            </div>
                            <div className="detail-item">
                                <span className="detail-label">Altitude</span>
                                <span className="detail-value">{selectedTarget.altitude || selectedTarget.alt || '—'}</span>
                            </div>
                            <div className="detail-item">
                                <span className="detail-label">Azimuth</span>
                                <span className="detail-value">{selectedTarget.azimuth || selectedTarget.az || '—'}</span>
                            </div>
                        </div>

                        {selectedTarget.description && (
                            <p className="target-description">{selectedTarget.description}</p>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}

export default Step2SelectTarget
