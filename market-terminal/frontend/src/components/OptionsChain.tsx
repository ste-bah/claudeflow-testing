/**
 * Options Chain Visualizer
 * TASK-UPDATE-005
 */
import React, { useState, useMemo, useEffect } from 'react';
import { useOptionsChain, useExpirations, OptionsChainFilters } from '../hooks/useOptionsChain';
import { OptionContract } from '../types/options';

// ---------------------------------------------------------------------------
// Props & Shared Utilities
// ---------------------------------------------------------------------------

interface OptionsChainProps {
    symbol: string;
}

const formatNumber = (val: number | null, decimals = 2) => {
    if (val === null) return '-';
    return Number(val).toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    });
};

const formatCurrency = (val: number | null) => {
    if (val === null) return '-';
    return `$${Number(val).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
};

// ---------------------------------------------------------------------------
// Sub-Components (Memoized for Performance)
// ---------------------------------------------------------------------------

const ContractRow = React.memo(({
    contract,
    isCall,
}: {
    contract: OptionContract | null;
    isCall: boolean;
}) => {
    if (!contract) {
        return (
            <React.Fragment>
                <td className="p-2 text-right text-gray-400">-</td>
                <td className="p-2 text-right text-gray-400">-</td>
                <td className="p-2 text-right text-gray-400">-</td>
                <td className="p-2 text-right text-gray-400">-</td>
                <td className="p-2 text-right text-gray-400">-</td>
                <td className="p-2 text-right text-gray-400">-</td>
                <td className="p-2 text-right text-gray-400">-</td>
                <td className="p-2 text-right text-gray-400">-</td>
                <td className="p-2 text-right text-gray-400">-</td>
                <td className="p-2 text-right text-gray-400">-</td>
            </React.Fragment>
        );
    }

    // Reverse column order for puts so Strike is cleanly down the center
    const cells = [
        <td key="bid" className="p-2 text-right">{formatNumber(contract.bid)}</td>,
        <td key="ask" className="p-2 text-right">{formatNumber(contract.ask)}</td>,
        <td key="last" className="p-2 text-right">{formatNumber(contract.lastPrice)}</td>,
        <td key="vol" className="p-2 text-right">{formatNumber(contract.volume, 0)}</td>,
        <td key="oi" className="p-2 text-right">{formatNumber(contract.openInterest, 0)}</td>,
        <td key="iv" className="p-2 text-right">{formatNumber(contract.impliedVolatility, 4)}</td>,
        <td key="delta" className="p-2 text-right">{formatNumber(contract.delta, 4)}</td>,
        <td key="gamma" className="p-2 text-right">{formatNumber(contract.gamma, 4)}</td>,
        <td key="theta" className="p-2 text-right">{formatNumber(contract.theta, 4)}</td>,
        <td key="vega" className="p-2 text-right">{formatNumber(contract.vega, 4)}</td>,
    ];

    if (!isCall) {
        cells.reverse();
    }

    return <React.Fragment>{cells}</React.Fragment>;
});
ContractRow.displayName = 'ContractRow';


const SkeletonRow = () => (
    <tr className="border-b border-gray-100 animate-pulse">
        {[...Array(10)].map((_, i) => (
            <td key={`call-${i}`} className="p-2"><div className="h-4 bg-gray-200 rounded w-full"></div></td>
        ))}
        <td className="p-2 bg-gray-50 text-center font-bold font-mono">
            <div className="h-4 bg-gray-300 rounded w-12 mx-auto"></div>
        </td>
        {[...Array(10)].map((_, i) => (
            <td key={`put-${i}`} className="p-2"><div className="h-4 bg-gray-200 rounded w-full"></div></td>
        ))}
    </tr>
);


// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export const OptionsChainComponent: React.FC<OptionsChainProps> = ({ symbol }) => {
    const { expirations, isLoading: expLoading } = useExpirations(symbol);
    const nearestExp = expirations.length > 0 ? expirations[0].expirationDate : undefined;

    const [selectedExp, setSelectedExp] = useState<string | undefined>(nearestExp);

    // Sync earliest exp once loaded if we haven't selected one
    useEffect(() => {
        if (!selectedExp && expirations.length > 0) {
            setSelectedExp(expirations[0].expirationDate);
        }
    }, [expirations, selectedExp]);

    const filters: OptionsChainFilters = useMemo(() => ({
        expirationGte: selectedExp,
        expirationLte: selectedExp,
        contractType: 'both',
    }), [selectedExp]);

    const { data, isLoading, error, isDelayed, cacheAge, isStale } = useOptionsChain(symbol, filters);

    // Group by strike
    const strikes = useMemo(() => {
        if (!data?.chain) return [];

        const strikeMap = new Map<number, { call: OptionContract | null, put: OptionContract | null }>();

        data.chain.forEach(contract => {
            const s = contract.strike;
            if (!strikeMap.has(s)) {
                strikeMap.set(s, { call: null, put: null });
            }

            const entry = strikeMap.get(s)!;
            if (contract.contractType === 'call') {
                entry.call = contract;
            } else {
                entry.put = contract;
            }
        });

        return Array.from(strikeMap.entries()).sort((a, b) => a[0] - b[0]);
    }, [data?.chain]);

    // Handle headers
    const callHeaders = ['Bid', 'Ask', 'Last', 'Vol', 'OI', 'IV', 'Delta', 'Gamma', 'Theta', 'Vega'];
    const putHeaders = [...callHeaders].reverse();

    return (
        <div className="w-full flex flex-col space-y-4">

            {/* ---------------- Header Area ---------------- */}
            <div className="flex flex-row justify-between items-end pb-4 border-b">
                <div>
                    <h2 className="text-xl font-bold flex items-center space-x-3">
                        <span>{symbol.toUpperCase()} Options</span>
                        {data?.underlyingPrice !== null && data?.underlyingPrice !== undefined && (
                            <span className="text-lg text-gray-600 font-mono">
                                {formatCurrency(data.underlyingPrice)}
                            </span>
                        )}
                    </h2>

                    <div className="flex items-center space-x-2 mt-2">
                        {isDelayed && (
                            <span className="inline-block bg-amber-100 text-amber-800 text-xs px-2 py-1 rounded font-semibold">
                                Delayed 15 min (Starter tier)
                            </span>
                        )}
                        {isStale && (
                            <span className="inline-block bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded">
                                Data may be stale
                            </span>
                        )}
                    </div>
                </div>

                <div className="flex flex-col items-end space-y-2">
                    <label className="text-sm font-semibold text-gray-600">Expiration</label>
                    <select
                        value={selectedExp || ''}
                        onChange={e => setSelectedExp(e.target.value)}
                        disabled={expLoading || expirations.length === 0}
                        className="border p-1 rounded min-w-[140px]"
                    >
                        <option value="">-- Select --</option>
                        {expirations.map(exp => (
                            <option key={exp.expirationDate} value={exp.expirationDate}>
                                {exp.expirationDate} ({exp.contractCount})
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* ---------------- Error & Loading Overlays ---------------- */}
            {error && !isLoading && (
                <div className="p-4 bg-red-50 text-red-700 rounded border border-red-200">
                    {error}
                </div>
            )}

            {/* ---------------- Straddle Table ---------------- */}
            <div className="overflow-x-auto rounded border shadow-sm relative">
                {isLoading && data && (
                    <div className="absolute inset-0 bg-white/50 flex place-content-center pt-24 z-10">
                        <span className="animate-pulse font-semibold text-gray-600">Updating...</span>
                    </div>
                )}

                <table className="w-full text-sm text-left">
                    <thead className="bg-gray-100 border-b text-xs uppercase text-gray-600">
                        <tr>
                            <th colSpan={10} className="p-2 text-center border-r bg-blue-50/50">Calls</th>
                            <th className="p-2 text-center bg-gray-200 w-24">Strike</th>
                            <th colSpan={10} className="p-2 text-center border-l bg-purple-50/50">Puts</th>
                        </tr>
                        <tr className="border-t border-gray-200">
                            {callHeaders.map((h, i) => (
                                <th key={`ch-${i}`} className="p-2 font-medium text-right bg-blue-50/30">{h}</th>
                            ))}
                            <th className="p-2 bg-gray-200"></th>
                            {putHeaders.map((h, i) => (
                                <th key={`ph-${i}`} className="p-2 font-medium text-right bg-purple-50/30">{h}</th>
                            ))}
                        </tr>
                    </thead>

                    <tbody className="divide-y">
                        {isLoading && !data && (
                            <React.Fragment>
                                <SkeletonRow /><SkeletonRow /><SkeletonRow /><SkeletonRow /><SkeletonRow />
                            </React.Fragment>
                        )}

                        {!isLoading && data && data.chain.length === 0 && (
                            <tr>
                                <td colSpan={21} className="p-12 text-center text-gray-500">
                                    No options contracts available for this symbol
                                </td>
                            </tr>
                        )}

                        {strikes.map(([strike, { call, put }]) => (
                            <tr key={strike} className="hover:bg-gray-50 transition-colors">
                                <ContractRow contract={call} isCall={true} />

                                <td className="p-2 text-center font-bold font-mono bg-gray-100 border-x">
                                    {formatNumber(strike)}
                                </td>

                                <ContractRow contract={put} isCall={false} />
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* ---------------- Footer Stats ---------------- */}
            {data && (
                <div className="flex justify-between items-center text-xs text-gray-500 pt-2">
                    <span>Showing {data.chain.length} of {data.contractCount} contracts</span>
                    <span>Data from: Massive | Updated: {cacheAge !== null ? cacheAge + 'ms' : 'just now'}</span>
                </div>
            )}

        </div>
    );
};
