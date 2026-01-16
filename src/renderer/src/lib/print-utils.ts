interface PrintOptions {
  title: string
  content: string
  styles?: string
}

export const printContent = async ({ title, content, styles = '' }: PrintOptions) => {
  console.log('📄 Preparing print content for IPC...')
  const htmlContent = `
        <html>
            <head>
                <title>${title}</title>
                <style>
                    body { 
                        font-family: Arial, sans-serif; 
                        padding: 0; 
                        margin: 0; 
                        color: #000; 
                        background: white; 
                        font-size: 12px;
                        width: 100%;
                    }
                    .text-center { text-align: center; }
                    .text-right { text-align: right; }
                    .font-bold { font-weight: bold; }
                    .uppercase { text-transform: uppercase; }
                    .mb-4 { margin-bottom: 5px; }
                    .border-b { border-bottom: 1px dashed #000; }
                    .flex { display: flex; }
                    .justify-between { justify-content: space-between; }
                    table { width: 100%; border-collapse: collapse; }
                    
                    @media print {
                         @page { 
                            size: 80mm auto;
                            margin: 0; 
                        }
                         body { margin: 0; padding: 0; }
                    }
                    ${styles}
                </style>
            </head>
            <body>
                ${content.replace(/<svg[\s\S]*?<\/svg>/g, '') /* Strip any SVGs */}
            </body>
        </html>
    `

  try {
    if (!window.api || !window.api.printer) {
      alert('Printer API not found! Please restart the application.')
      console.error('window.api.printer is undefined')
      return
    }
    await window.api.printer.printReceipt(htmlContent)
  } catch (error) {
    console.error('Failed to print receipt:', error)
    alert(`Print failed: ${error}`)
  }
}
