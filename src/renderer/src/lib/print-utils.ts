
interface PrintOptions {
    title: string;
    content: string;
    styles?: string;
}

export const printContent = async ({ title, content, styles = '' }: PrintOptions) => {
    const htmlContent = `
        <html>
            <head>
                <title>${title}</title>
                <style>
                    body { font-family: 'Courier New', Courier, monospace; padding: 20px; color: #000; background: white; }
                    .text-center { text-align: center; }
                    .text-right { text-align: right; }
                    .font-bold { font-weight: bold; }
                    .uppercase { text-transform: uppercase; }
                    .text-sm { font-size: 14px; }
                    .text-xs { font-size: 12px; }
                    .mb-4 { margin-bottom: 16px; }
                    .mb-2 { margin-bottom: 8px; }
                    .py-2 { padding-top: 8px; padding-bottom: 8px; }
                    .border-b { border-bottom: 1px dashed #000; }
                    .border-t { border-top: 1px dashed #000; }
                    .flex { display: flex; }
                    .justify-between { justify-content: space-between; }
                    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                    th, td { text-align: left; padding: 8px; border-bottom: 1px solid #ddd; }
                    th { border-bottom: 2px solid #000; }
                    .footer { margin-top: 40px; text-align: center; font-size: 12px; }
                    
                    @media print {
                         @page { size: auto; margin: 5mm; }
                         body { padding: 10px; -webkit-print-color-adjust: exact; }
                    }
                    ${styles}
                </style>
            </head>
            <body>
                ${content}
            </body>
        </html>
    `;

    try {
        if (!window.api || !window.api.printer) {
             alert("Printer API not found! Please restart the application.");
             console.error("window.api.printer is undefined");
             return;
        }
        await window.api.printer.printReceipt(htmlContent);
    } catch (error) {
        console.error('Failed to print receipt:', error);
        alert(`Print failed: ${error}`);
    }
};
