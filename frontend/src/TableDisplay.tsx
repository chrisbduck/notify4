import React from 'react';
import './TableDisplay.css';

export interface TableAttribute<T> {
    label: string;
    render: (item: T) => React.ReactNode;
    firstColSpan?: number;
}

interface TableDisplayProps<T> {
    dataNow: T | null;
    dataLater: T | null;
    attributes: TableAttribute<T>[];
    laterColumnHeader: string;
}

const TableDisplay = <T,>({ dataNow, dataLater, attributes, laterColumnHeader }: React.PropsWithChildren<TableDisplayProps<T>>) => {
    if (!dataNow) {
        return <p>Loading data...</p>;
    }

    return (
        <table className="weather-table">
            <thead>
                <tr>
                    <th>Item</th>
                    <th>Now</th>
                    {dataLater && <th>{laterColumnHeader}</th>}
                </tr>
            </thead>
            <tbody>
                {attributes.map((attribute, index) => {
                    const firstColSpan = attribute.firstColSpan ?? 1;
                    return (
                        <tr key={index}>
                            <td><strong>{attribute.label}</strong></td>
                            <td colSpan={firstColSpan}>{dataNow ? attribute.render(dataNow) : 'N/A'}</td>
                            {dataLater && firstColSpan === 1 ? <td>{attribute.render(dataLater)}</td> : null}
                        </tr>
                    );
                })}
            </tbody>
        </table>
    );
};

export default TableDisplay;
