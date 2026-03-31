import React, { useState, useRef } from 'react';
import html2pdf from 'html2pdf.js';
import { Download, FileCode2, Plus, Trash2, FileText, Upload } from 'lucide-react';
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import './index.css';

const initialData = {
  date: new Date().toISOString().split('T')[0],
  quotationNo: '',
  clientName: '',
  projectName: '',
  providerName: '',
  providerCEO: '',
  providerAddress: '',
  providerPhone: '',
  providerEmail: '',
  providerBizNo: '',
  items: [
    { id: 1, description: '', quantity: 1, price: 0 },
    { id: 2, description: '', quantity: 1, price: 0 },
    { id: 3, description: '', quantity: 1, price: 0 },
  ],
  taxRate: '',
  notes: '',
};

function App() {
  const [data, setData] = useState(initialData);
  const [downloadFileName, setDownloadFileName] = useState('');
  const [importStatus, setImportStatus] = useState('');
  const previewRef = useRef(null);
  GlobalWorkerOptions.workerSrc = pdfWorker;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setData(prev => ({ ...prev, [name]: value }));
  };

  const handleItemChange = (id, field, value) => {
    setData(prev => ({
      ...prev,
      items: prev.items.map(item => item.id === id ? { ...item, [field]: field === 'description' ? value : Number(value) } : item)
    }));
  };

  const addItem = () => {
    setData(prev => ({
      ...prev,
      items: [...prev.items, { id: Date.now(), description: '', quantity: 1, price: 0 }]
    }));
  };

  const removeItem = (id) => {
    setData(prev => ({
      ...prev,
      items: prev.items.filter(item => item.id !== id)
    }));
  };

  const calculateSubTotal = () => {
    return data.items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
  };

  const subTotal = calculateSubTotal();
  const taxAmount = Math.floor(subTotal * (data.taxRate / 100));
  const grandTotal = subTotal + taxAmount;

  const sanitizeFileName = (name) => {
    const safeName = name.trim().replace(/[\\/:*?"<>|]/g, '_');
    return safeName || '견적서';
  };

  const toNumber = (value) => {
    const cleaned = String(value ?? '').replace(/[^\d.-]/g, '');
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const extractByRegex = (text, patterns) => {
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
    return '';
  };

  const parseDate = (text) => {
    const isoMatch = text.match(/(\d{4})[-./](\d{1,2})[-./](\d{1,2})/);
    if (isoMatch) {
      const y = isoMatch[1];
      const m = isoMatch[2].padStart(2, '0');
      const d = isoMatch[3].padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    const korMatch = text.match(/(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일/);
    if (korMatch) {
      const y = korMatch[1];
      const m = korMatch[2].padStart(2, '0');
      const d = korMatch[3].padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    return '';
  };

  const parseItems = (text) => {
    const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
    const items = [];
    for (const line of lines) {
      const match = line.match(/^\d+\s+(.+?)\s+(\d+)\s+([\d,]+)\s+([\d,]+)$/);
      if (match) {
        items.push({
          id: Date.now() + items.length,
          description: match[1].trim(),
          quantity: toNumber(match[2]) || 1,
          price: toNumber(match[3]),
        });
      }
    }
    return items;
  };

  const mapExtractedTextToData = (rawText) => {
    const text = rawText.replace(/\r/g, '');
    const mappedItems = parseItems(text);
    const mappedDate = parseDate(text);

    const quotationNo = extractByRegex(text, [
      /견적번호\s*[:：]?\s*([A-Za-z0-9_-]+)/,
      /Quotation\s*No\.?\s*[:：]?\s*([A-Za-z0-9_-]+)/i
    ]);
    const clientName = extractByRegex(text, [
      /수신\s*[:：]?\s*([^\n]+)/,
      /받는\s*분\s*[:：]?\s*([^\n]+)/,
      /Client\s*[:：]?\s*([^\n]+)/i
    ]).replace(/\s*귀하\(사\)?$/, '').trim();
    const projectName = extractByRegex(text, [
      /건명\s*[:：]?\s*([^\n]+)/,
      /프로젝트\s*[:：]?\s*([^\n]+)/,
      /Project\s*[:：]?\s*([^\n]+)/i
    ]);
    const providerBizNo = extractByRegex(text, [
      /등록번호\s*[:：]?\s*([0-9-]+)/,
      /사업자등록번호\s*[:：]?\s*([0-9-]+)/,
      /Business\s*No\.?\s*[:：]?\s*([0-9-]+)/i
    ]);
    const providerName = extractByRegex(text, [
      /상호\(법인\)\s*[:：]?\s*([^\n]+)/,
      /상호\(법인명\)\s*[:：]?\s*([^\n]+)/,
      /상호\s*[:：]?\s*([^\n]+)/,
      /Provider\s*[:：]?\s*([^\n]+)/i
    ]);
    const providerCEO = extractByRegex(text, [
      /대표자\s*[:：]?\s*([^\n]+)/,
      /CEO\s*[:：]?\s*([^\n]+)/i
    ]);
    const providerAddress = extractByRegex(text, [
      /사업장\s*[:：]?\s*([^\n]+)/,
      /주소\s*[:：]?\s*([^\n]+)/,
      /Address\s*[:：]?\s*([^\n]+)/i
    ]);
    const providerPhone = extractByRegex(text, [
      /연락처\s*[:：]?\s*([0-9-+\s]+)/,
      /전화\s*[:：]?\s*([0-9-+\s]+)/,
      /Phone\s*[:：]?\s*([0-9-+\s]+)/i
    ]);
    const notes = extractByRegex(text, [
      /\[\s*비고 및 특이사항\s*\]\s*([\s\S]+)/,
      /비고\s*[:：]?\s*([\s\S]+)/,
      /Notes?\s*[:：]?\s*([\s\S]+)/i
    ]).trim();
    const taxRate = extractByRegex(text, [
      /부가세.*?(\d{1,2})\s*%/,
      /VAT.*?(\d{1,2})\s*%/i
    ]);

    return {
      date: mappedDate || data.date,
      quotationNo,
      clientName,
      projectName,
      providerName,
      providerCEO,
      providerAddress,
      providerPhone,
      providerBizNo,
      taxRate,
      notes,
      items: mappedItems,
    };
  };

  const extractTextFromPdf = async (file) => {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    const pages = [];
    for (let pageNo = 1; pageNo <= pdf.numPages; pageNo += 1) {
      const page = await pdf.getPage(pageNo);
      const content = await page.getTextContent();
      const text = content.items.map((item) => item.str).join(' ');
      pages.push(text);
    }
    return pages.join('\n');
  };

  const handleImportFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      let rawText = '';
      if (file.type === 'text/html' || file.name.toLowerCase().endsWith('.html')) {
        const html = await file.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        rawText = doc.body?.textContent || '';
      } else if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        rawText = await extractTextFromPdf(file);
      } else {
        setImportStatus('PDF 또는 HTML 파일만 불러올 수 있습니다.');
        return;
      }

      const mapped = mapExtractedTextToData(rawText);
      setData((prev) => ({
        ...prev,
        ...mapped,
        items: mapped.items.length > 0 ? mapped.items : prev.items,
      }));
      setImportStatus(`${file.name} 파일 내용을 불러왔습니다. 필요한 항목은 수정하세요.`);
    } catch {
      setImportStatus('파일 불러오기에 실패했습니다. 파일 형식을 확인해주세요.');
    } finally {
      event.target.value = '';
    }
  };

  const getFormatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;
  };

  // PDF 다운로드
  const handleDownloadPDF = () => {
    const element = previewRef.current;
    const baseFileName = sanitizeFileName(downloadFileName || data.quotationNo || '견적서');


    const opt = {
      margin: [10, 10, 10, 10], 
      filename: `${baseFileName}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, logging: false },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(element).save();
  };

  // HTML 다운로드
  const handleDownloadHTML = () => {
    const element = previewRef.current;
    const baseFileName = sanitizeFileName(downloadFileName || data.quotationNo || '견적서');

    const inlineCSS = `
      body { font-family: 'Inter', 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif; background: #fff; color: #000; padding: 20px; }
      .container { max-width: 800px; margin: 0 auto; }
      .document-preview { padding: 40px; background: white; border: 1px solid #ddd; }
      .doc-header { text-align: center; margin-bottom: 30px; border-bottom: 3px solid #000; padding-bottom: 10px; }
      .doc-title { font-size: 2.5rem; font-weight: bold; letter-spacing: 0.5rem; margin-bottom: 5px; }
      .doc-info-grid { display: flex; justify-content: space-between; margin-bottom: 30px; }
      .doc-info-box { width: 48%; }
      .doc-info-item { display: flex; margin-bottom: 8px; font-size: 0.95rem; }
      .doc-info-label { font-weight: 600; width: 100px; flex-shrink: 0; }
      .doc-info-value { flex-grow: 1; border-bottom: 1px dotted #ccc; }
      .provider-info { border: 2px solid #000; padding: 15px; }
      .amount-box { background: #f8fafc; padding: 15px; font-size: 1.25rem; font-weight: bold; text-align: center; margin-bottom: 20px; border: 1px solid #e2e8f0; }
      table.items-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
      table.items-table th, table.items-table td { border: 1px solid #cbd5e1; padding: 10px; text-align: left; font-size: 0.9rem; }
      table.items-table th { background-color: #f1f5f9; font-weight: 600; text-align: center; }
      table.items-table td.number { text-align: right; }
      .totals-area { display: flex; justify-content: flex-end; margin-bottom: 30px; }
      .totals-table { width: 300px; border-collapse: collapse; }
      .totals-table th, .totals-table td { padding: 8px 12px; border-bottom: 1px solid #cbd5e1; }
      .totals-table th { text-align: left; background: #f8fafc; }
      .totals-table td { text-align: right; font-weight: 600; }
      .totals-table tr.grand-total th, .totals-table tr.grand-total td { font-size: 1.1rem; color: #0f172a; border-top: 2px solid #000; border-bottom: 2px solid #000; }
      .notes-area { margin-top: 20px; padding: 15px; background: #fafafa; border-left: 4px solid #94a3b8; font-size: 0.9rem; white-space: pre-wrap; }
    `;

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="ko">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>견적서_${data.quotationNo}</title>
        <style>${inlineCSS}</style>
      </head>
      <body>
        <div class="container">
          ${element.outerHTML}
        </div>
      </body>
      </html>
    `;

    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${baseFileName}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="app-container">
      <header className="header">
        <h1 className="title">견적서 자동완성 서비스</h1>
        <div className="actions">
          <input
            className="download-name-input"
            type="text"
            value={downloadFileName}
            onChange={(e) => setDownloadFileName(e.target.value)}
            placeholder="다운로드 파일명 입력"
          />
          <button className="btn btn-primary" onClick={handleDownloadPDF}>
            <Download size={18} />
            PDF 다운로드
          </button>
          <button className="btn" onClick={handleDownloadHTML}>
            <FileCode2 size={18} />
            HTML 다운로드
          </button>
        </div>
      </header>

      <main className="main-content">
        {/* Editor Form Section */}
        <section className="card editor-section">
          <h2 className="section-title">
            <FileText size={20} className="inline-block mr-2 align-middle" style={{ marginRight: '8px' }} />
            견적 정보 입력
          </h2>
          <div className="import-area">
            <label className="file-upload-label">
              <Upload size={16} />
              PDF/HTML 불러오기
              <input
                type="file"
                accept=".pdf,.html,text/html,application/pdf"
                onChange={handleImportFile}
              />
            </label>
            {importStatus && <p className="import-status">{importStatus}</p>}
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label>견적일자</label>
              <input type="date" name="date" value={data.date} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label>견적번호</label>
              <input type="text" name="quotationNo" value={data.quotationNo} onChange={handleChange} placeholder="예: EST-240331" />
            </div>
            <div className="form-group">
              <label>수신 (고객명)</label>
              <input type="text" name="clientName" value={data.clientName} onChange={handleChange} placeholder="예: 홍길동 / (주)고객사" />
            </div>
            <div className="form-group">
              <label>건명 (프로젝트)</label>
              <input type="text" name="projectName" value={data.projectName} onChange={handleChange} placeholder="예: 웹사이트 구축 프로젝트" />
            </div>
          </div>

          <h3 className="section-title" style={{ marginTop: '1.5rem' }}>공급자 정보</h3>
          <div className="grid-2">
            <div className="form-group">
              <label>상호(법인명)</label>
              <input type="text" name="providerName" value={data.providerName} onChange={handleChange} placeholder="예: (주)서린테크" />
            </div>
            <div className="form-group">
              <label>대표자</label>
              <input type="text" name="providerCEO" value={data.providerCEO} onChange={handleChange} placeholder="예: 김대표" />
            </div>
            <div className="form-group">
              <label>사업자등록번호</label>
              <input type="text" name="providerBizNo" value={data.providerBizNo} onChange={handleChange} placeholder="예: 123-45-67890" />
            </div>
            <div className="form-group">
              <label>연락처</label>
              <input type="text" name="providerPhone" value={data.providerPhone} onChange={handleChange} placeholder="예: 010-1234-5678" />
            </div>
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label>주소</label>
              <input type="text" name="providerAddress" value={data.providerAddress} onChange={handleChange} placeholder="예: 서울시 강남구 테헤란로 123" />
            </div>
          </div>

          <h3 className="section-title" style={{ marginTop: '1.5rem' }}>상세 내역</h3>
          <div className="items-editor">
            <div className="item-row" style={{ fontWeight: 600, color: 'var(--text-muted)' }}>
              <span>품목/내용</span>
              <span>수량</span>
              <span>단가(원)</span>
              <span>삭제</span>
            </div>
            {data.items.map((item) => (
              <div key={item.id} className="item-row">
                <input
                  type="text"
                  value={item.description}
                  onChange={(e) => handleItemChange(item.id, 'description', e.target.value)}
                  placeholder="품목명 입력"
                />
                <input
                  type="number"
                  min="1"
                  value={item.quantity}
                  onChange={(e) => handleItemChange(item.id, 'quantity', e.target.value)}
                  placeholder="예: 1"
                />
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={item.price}
                  onChange={(e) => handleItemChange(item.id, 'price', e.target.value)}
                  placeholder="예: 50000"
                />
                <button className="btn-icon" onClick={() => removeItem(item.id)} title="삭제">
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
            <button className="add-item-btn" onClick={addItem} style={{ marginTop: '1rem' }}>
              <Plus size={18} /> 항목 추가
            </button>
          </div>

          <h3 className="section-title" style={{ marginTop: '1.5rem' }}>추가 사항</h3>
          <div className="form-group">
            <label>부가세(VAT) 요율 (%)</label>
            <input type="number" name="taxRate" value={data.taxRate} onChange={handleChange} placeholder="예: 10" />
          </div>
          <div className="form-group">
            <label>비고 및 안내사항 (Notes)</label>
            <textarea name="notes" rows="4" value={data.notes} onChange={handleChange} placeholder="예: 유효기간 30일 / 선금 50% / VAT 별도"></textarea>
          </div>
        </section>

        {/* Live Preview Section */}
        <section className="preview-wrapper">
          <div className="document-preview" ref={previewRef} id="quotation-preview">
            <div className="doc-header">
              <h2 className="doc-title">견적서</h2>
            </div>

            <div className="doc-info-grid">
              <div className="doc-info-box">
                <div className="doc-info-item">
                  <span className="doc-info-label">견적번호</span>
                  <span className="doc-info-value">{data.quotationNo}</span>
                </div>
                <div className="doc-info-item">
                  <span className="doc-info-label">견적일자</span>
                  <span className="doc-info-value">{getFormatDate(data.date)}</span>
                </div>
                <div className="doc-info-item">
                  <span className="doc-info-label">수신</span>
                  <span className="doc-info-value"><strong>{data.clientName}</strong> 귀하(사)</span>
                </div>
                <div className="doc-info-item" style={{ marginTop: '15px' }}>
                  <span className="doc-info-label">건명</span>
                  <span className="doc-info-value">{data.projectName}</span>
                </div>
              </div>

              <div className="doc-info-box provider-info">
                <div style={{ fontWeight: 'bold', borderBottom: '1px solid #000', paddingBottom: '5px', marginBottom: '10px' }}>공급자 (Provider)</div>
                <div className="doc-info-item">
                  <span className="doc-info-label" style={{ width: '80px' }}>등록번호</span>
                  <span className="doc-info-value">{data.providerBizNo}</span>
                </div>
                <div className="doc-info-item">
                  <span className="doc-info-label" style={{ width: '80px' }}>상호(법인)</span>
                  <span className="doc-info-value">{data.providerName}</span>
                </div>
                <div className="doc-info-item">
                  <span className="doc-info-label" style={{ width: '80px' }}>대표자</span>
                  <span className="doc-info-value">{data.providerCEO}</span>
                </div>
                <div className="doc-info-item">
                  <span className="doc-info-label" style={{ width: '80px' }}>사업장</span>
                  <span className="doc-info-value">{data.providerAddress}</span>
                </div>
                <div className="doc-info-item">
                  <span className="doc-info-label" style={{ width: '80px' }}>연락처</span>
                  <span className="doc-info-value">{data.providerPhone}</span>
                </div>
              </div>
            </div>

            <div className="amount-box">
              견적금액 (Total Amount) : ₩ {grandTotal.toLocaleString()} (VAT 포함)
            </div>

            <table className="items-table">
              <thead>
                <tr>
                  <th style={{ width: '50px' }}>No.</th>
                  <th>품명 및 규격 (Description)</th>
                  <th style={{ width: '80px' }}>수량 (Qty)</th>
                  <th style={{ width: '120px' }}>단가 (Unit Price)</th>
                  <th style={{ width: '130px' }}>금액 (Amount)</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item, index) => (
                  <tr key={item.id}>
                    <td style={{ textAlign: 'center' }}>{index + 1}</td>
                    <td>{item.description}</td>
                    <td className="number">{item.quantity}</td>
                    <td className="number">{item.price.toLocaleString()}</td>
                    <td className="number">{(item.quantity * item.price).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="totals-area">
              <table className="totals-table">
                <tbody>
                  <tr>
                    <th>공급가액 (Subtotal)</th>
                    <td>₩ {subTotal.toLocaleString()}</td>
                  </tr>
                  <tr>
                    <th>부가세 (VAT)</th>
                    <td>₩ {taxAmount.toLocaleString()}</td>
                  </tr>
                  <tr className="grand-total">
                    <th>총 합계 (Grand Total)</th>
                    <td>₩ {grandTotal.toLocaleString()}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="notes-area">
              <strong>[ 비고 및 특이사항 ]</strong><br />
              {data.notes}
            </div>

            <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '1.2rem', fontWeight: 'bold' }}>
              위와 같이 견적합니다.
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
