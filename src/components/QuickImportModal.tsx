'use client'

import { useState, useRef, useId } from 'react'
import * as XLSX from 'xlsx'
import { pinyin } from 'pinyin-pro'
import {
  Upload,
  FileSpreadsheet,
  FileText,
  Check,
  X,
  Download,
  AlertCircle,
  Wand2,
  Sparkles,
  Layers,
  Info,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

export interface ParsedCardItem {
  id?: string
  term: string
  phonetic?: string
  definition: string
  example_sentence?: string
}

interface QuickImportModalProps {
  isOpen: boolean
  onClose: () => void
  onImport: (cards: ParsedCardItem[], mode: 'append' | 'replace') => void
  existingCount?: number
}

type TabType = 'excel' | 'text'
type ThreeColMode = 'phonetic-first' | 'definition-first'
type DelimiterType = 'auto' | 'tab' | 'dash' | 'comma' | 'semicolon' | 'colon' | 'custom'

export default function QuickImportModal({
  isOpen,
  onClose,
  onImport,
  existingCount = 0,
}: QuickImportModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('excel')
  const [file, setFile] = useState<File | null>(null)
  const [fileName, setFileName] = useState<string>('')
  const [importText, setImportText] = useState<string>('')
  const [delimiter, setDelimiter] = useState<DelimiterType>('auto')
  const [customDelimiter, setCustomDelimiter] = useState<string>('')
  const [threeColMode, setThreeColMode] = useState<ThreeColMode>('phonetic-first')
  const [autoPinyin, setAutoPinyin] = useState<boolean>(true)
  const [importMode, setImportMode] = useState<'append' | 'replace'>('append')
  const [parsedCards, setParsedCards] = useState<ParsedCardItem[]>([])
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState<boolean>(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const inputId = useId()

  if (!isOpen) return null

  // Tải file mẫu Excel
  const handleDownloadSample = () => {
    const sampleData = [
      ['Thuật ngữ', 'Phiên âm', 'Định nghĩa', 'Câu ví dụ'],
      ['Hello', '/həˈloʊ/', 'Xin chào', 'Hello, nice to meet you!'],
      ['你好', 'nǐ hǎo', 'Xin chào (tiếng Trung)', '你好！很高兴认识你。'],
      ['Serendipity', '/ˌser.ənˈdɪp.ə.ti/', 'Sự may mắn bất ngờ', 'It was pure [serendipity] that we met.'],
      ['Gratitude', '/ˈɡrætɪtjuːd/', 'Lòng biết ơn', 'Expressing [gratitude] makes us happier.'],
      ['Book', '/bʊk/', 'Quyển sách', 'I love reading books.'],
    ]
    const ws = XLSX.utils.aoa_to_sheet(sampleData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Từ vựng')
    XLSX.writeFile(wb, 'mau_nhap_the_quizlet.xlsx')
  }

  // Chuẩn hoá Pinyin nếu cần
  const resolvePinyin = (term: string, currentPhonetic?: string) => {
    if (currentPhonetic && currentPhonetic.trim()) return currentPhonetic.trim()
    if (autoPinyin && /[\u4e00-\u9fa5]/.test(term)) {
      try {
        return pinyin(term.trim())
      } catch (e) {
        return ''
      }
    }
    return currentPhonetic?.trim() || ''
  }

  // Xử lý dữ liệu thô từ Excel
  const parseRawRows = (rows: any[][]) => {
    if (!rows || rows.length === 0) {
      setParsedCards([])
      setErrorMsg('File không có dữ liệu.')
      return
    }

    let startIndex = 0
    // Kiểm tra dòng đầu có phải header không
    const firstRowStr = rows[0]?.map((c) => String(c || '').toLowerCase().trim()) || []
    const headerKeywords = [
      'term',
      'thuật ngữ',
      'từ vựng',
      'từ',
      'definition',
      'định nghĩa',
      'nghĩa',
      'phonetic',
      'phiên âm',
      'pinyin',
      'ipa',
      'example',
      'ví dụ',
      'câu ví dụ',
      'stt',
      'no',
    ]

    const isHeader = firstRowStr.some((val) => headerKeywords.some((k) => val.includes(k)))
    if (isHeader) {
      startIndex = 1
    }

    const cards: ParsedCardItem[] = []

    for (let i = startIndex; i < rows.length; i++) {
      const row = rows[i]
      if (!row || !Array.isArray(row)) continue

      const cleanRow = row.map((cell) => (cell !== undefined && cell !== null ? String(cell).trim() : ''))
      if (cleanRow.every((c) => !c)) continue // Dòng trống

      const term = cleanRow[0] || ''
      if (!term) continue

      let phonetic = ''
      let definition = ''
      let example_sentence = ''

      if (cleanRow.length === 2) {
        definition = cleanRow[1] || ''
      } else if (cleanRow.length === 3) {
        if (threeColMode === 'phonetic-first') {
          phonetic = cleanRow[1] || ''
          definition = cleanRow[2] || ''
        } else {
          definition = cleanRow[1] || ''
          example_sentence = cleanRow[2] || ''
        }
      } else if (cleanRow.length >= 4) {
        phonetic = cleanRow[1] || ''
        definition = cleanRow[2] || ''
        example_sentence = cleanRow[3] || ''
      }

      if (definition) {
        cards.push({
          id: Math.random().toString(36).substring(2, 9),
          term,
          phonetic: resolvePinyin(term, phonetic),
          definition,
          example_sentence,
        })
      }
    }

    if (cards.length === 0) {
      setErrorMsg('Không tìm thấy thẻ hợp lệ (cần có tối thiểu Thuật ngữ và Định nghĩa).')
    } else {
      setErrorMsg(null)
    }

    setParsedCards(cards)
  }

  // Đọc file Excel / CSV
  const handleProcessFile = (selectedFile: File) => {
    setErrorMsg(null)
    setFile(selectedFile)
    setFileName(selectedFile.name)

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = e.target?.result
        const workbook = XLSX.read(data, { type: 'array' })
        const firstSheetName = workbook.SheetNames[0]
        if (!firstSheetName) {
          setErrorMsg('File Excel không có trang tính (sheet) nào.')
          return
        }
        const worksheet = workbook.Sheets[firstSheetName]
        const rawRows: any[][] = XLSX.utils.sheet_to_json(worksheet, {
          header: 1,
          blankrows: false,
        })
        parseRawRows(rawRows)
      } catch (err: any) {
        console.error('Lỗi đọc file Excel:', err)
        setErrorMsg('Không thể đọc file. Vui lòng kiểm tra định dạng .xlsx, .xls hoặc .csv.')
      }
    }
    reader.readAsArrayBuffer(selectedFile)
  }

  // Xử lý Textarea dán văn bản
  const handleParseText = (textValue = importText, customDelim = customDelimiter, delimType = delimiter) => {
    if (!textValue.trim()) {
      setParsedCards([])
      setErrorMsg(null)
      return
    }

    const lines = textValue.split(/\r?\n/)
    const cards: ParsedCardItem[] = []

    lines.forEach((line) => {
      const trimmed = line.trim()
      if (!trimmed) return

      let parts: string[] = []

      if (delimType === 'custom' && customDelim) {
        parts = trimmed.split(customDelim).map((p) => p.trim())
      } else if (delimType === 'tab') {
        parts = trimmed.split('\t').map((p) => p.trim())
      } else if (delimType === 'dash') {
        // Hỗ trợ cả " - " lẫn "-" (chia theo dấu gạch ngang)
        parts = trimmed.split(/\s*-\s*/).map((p) => p.trim())
      } else if (delimType === 'comma') {
        parts = trimmed.split(',').map((p) => p.trim())
      } else if (delimType === 'semicolon') {
        parts = trimmed.split(';').map((p) => p.trim())
      } else if (delimType === 'colon') {
        parts = trimmed.split(':').map((p) => p.trim())
      } else {
        // Auto-detect thông minh
        if (trimmed.includes('\t')) {
          parts = trimmed.split('\t').map((p) => p.trim())
        } else if (/\s*-\s*/.test(trimmed) && trimmed.includes('-')) {
          parts = trimmed.split(/\s*-\s*/).map((p) => p.trim())
        } else if (trimmed.includes(';')) {
          parts = trimmed.split(';').map((p) => p.trim())
        } else if (trimmed.includes(',')) {
          parts = trimmed.split(',').map((p) => p.trim())
        } else if (trimmed.includes('|')) {
          parts = trimmed.split('|').map((p) => p.trim())
        } else if (trimmed.includes(':')) {
          parts = trimmed.split(':').map((p) => p.trim())
        } else {
          parts = [trimmed]
        }
      }

      if (parts.length >= 2) {
        const term = parts[0] || ''
        let phonetic = ''
        let definition = ''
        let example_sentence = ''

        if (parts.length === 2) {
          definition = parts[1] || ''
        } else if (parts.length === 3) {
          if (threeColMode === 'phonetic-first') {
            phonetic = parts[1] || ''
            definition = parts[2] || ''
          } else {
            definition = parts[1] || ''
            example_sentence = parts[2] || ''
          }
        } else if (parts.length >= 4) {
          phonetic = parts[1] || ''
          definition = parts[2] || ''
          example_sentence = parts[3] || ''
        }

        if (term && definition) {
          cards.push({
            id: Math.random().toString(36).substring(2, 9),
            term,
            phonetic: resolvePinyin(term, phonetic),
            definition,
            example_sentence,
          })
        }
      }
    })

    if (cards.length === 0) {
      setErrorMsg('Chưa nhận diện được thẻ nào. Hãy kiểm tra lại dấu phân cách giữa các cột.')
    } else {
      setErrorMsg(null)
    }

    setParsedCards(cards)
  }

  const handleTextChange = (val: string) => {
    setImportText(val)
    handleParseText(val, customDelimiter, delimiter)
  }

  const handleDelimiterChange = (val: DelimiterType) => {
    setDelimiter(val)
    handleParseText(importText, customDelimiter, val)
  }

  const handleCustomDelimChange = (val: string) => {
    setCustomDelimiter(val)
    handleParseText(importText, val, delimiter)
  }

  const handleThreeColChange = (val: ThreeColMode) => {
    setThreeColMode(val)
    if (activeTab === 'excel' && file) {
      handleProcessFile(file)
    } else if (activeTab === 'text') {
      handleParseText(importText, customDelimiter, delimiter)
    }
  }

  const handleConfirmImport = () => {
    if (parsedCards.length === 0) return
    onImport(parsedCards, importMode)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl max-h-[90vh] flex flex-col bg-card border border-border/80 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/70 bg-muted/30">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <Sparkles className="size-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">Nhập dữ liệu nhanh & File Excel</h2>
              <p className="text-xs text-muted-foreground">
                Tự động tách cột, đọc Excel (.xlsx, .csv) và sinh Pinyin tiếng Trung
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="rounded-full size-8 text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </Button>
        </div>

        {/* Tab Switcher */}
        <div className="px-6 pt-3 pb-2 border-b border-border/50 flex flex-wrap items-center justify-between gap-3 bg-muted/10">
          <div className="flex items-center gap-1.5 p-1 bg-muted/60 rounded-xl border border-border/60">
            <button
              type="button"
              onClick={() => setActiveTab('excel')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                activeTab === 'excel'
                  ? 'bg-card text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <FileSpreadsheet className="size-3.5 text-emerald-600 dark:text-emerald-400" />
              Tải file Excel / CSV
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('text')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                activeTab === 'text'
                  ? 'bg-card text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <FileText className="size-3.5 text-indigo-600 dark:text-indigo-400" />
              Dán văn bản (Copy & Paste)
            </button>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleDownloadSample}
            className="gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
          >
            <Download className="size-3.5" /> Tải file Excel mẫu
          </Button>
        </div>

        {/* Body content (scrollable) */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Tab 1: Excel / CSV File Upload */}
          {activeTab === 'excel' && (
            <div className="space-y-4">
              <input
                ref={fileInputRef}
                id={inputId}
                type="file"
                accept=".xlsx, .xls, .csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) handleProcessFile(f)
                }}
              />

              <div
                onDragOver={(e) => {
                  e.preventDefault()
                  setIsDragging(true)
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault()
                  setIsDragging(false)
                  const f = e.dataTransfer.files?.[0]
                  if (f) handleProcessFile(f)
                }}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition flex flex-col items-center justify-center gap-3 ${
                  isDragging
                    ? 'border-indigo-500 bg-indigo-500/10'
                    : file
                    ? 'border-emerald-500/40 bg-emerald-500/5'
                    : 'border-border/80 hover:border-indigo-500/60 hover:bg-muted/30'
                }`}
              >
                <div
                  className={`size-12 rounded-full flex items-center justify-center ${
                    file
                      ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                      : 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
                  }`}
                >
                  {file ? <FileSpreadsheet className="size-6" /> : <Upload className="size-6" />}
                </div>

                <div>
                  <p className="font-semibold text-sm text-foreground">
                    {file ? fileName : 'Kéo thả file Excel / CSV vào đây hoặc bấm để chọn file'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Hỗ trợ định dạng .xlsx, .xls, .csv (Tối đa 10MB)
                  </p>
                </div>

                {file && (
                  <Badge variant="success" className="mt-1">
                    Đã chọn: {fileName}
                  </Badge>
                )}
              </div>

              {/* Format guidance */}
              <div className="rounded-xl border border-border/60 bg-muted/20 p-3.5 text-xs text-muted-foreground space-y-1.5">
                <div className="flex items-center gap-1.5 font-medium text-foreground">
                  <Info className="size-3.5 text-indigo-500" />
                  Quy ước cột trong file Excel:
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-[11px]">
                  <div className="bg-background/80 p-2 rounded-lg border border-border/40">
                    <span className="font-semibold text-foreground">Dạng 2 cột:</span>
                    <p>• Cột A: Thuật ngữ (bắt buộc)</p>
                    <p>• Cột B: Định nghĩa (bắt buộc)</p>
                  </div>
                  <div className="bg-background/80 p-2 rounded-lg border border-border/40">
                    <span className="font-semibold text-foreground">Dạng 3 hoặc 4 cột:</span>
                    <p>• Cột A: Thuật ngữ | Cột B: Phiên âm/Pinyin</p>
                    <p>• Cột C: Định nghĩa | Cột D: Câu ví dụ</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Paste Text */}
          {activeTab === 'text' && (
            <div className="space-y-4">
              {/* Delimiter Selection Toolbar */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Ký tự phân cách giữa các cột
                </label>
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  {[
                    { id: 'auto', label: 'Tự động nhận diện' },
                    { id: 'dash', label: 'Dấu gạch ngang (-)' },
                    { id: 'tab', label: 'Tab (Excel/Sheets)' },
                    { id: 'comma', label: 'Dấu phẩy (,)' },
                    { id: 'semicolon', label: 'Dấu chấm phẩy (;)' },
                    { id: 'colon', label: 'Dấu hai chấm (:)' },
                    { id: 'custom', label: 'Tùy chỉnh' },
                  ].map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => handleDelimiterChange(d.id as DelimiterType)}
                      className={`px-2.5 py-1 rounded-md border text-xs font-medium transition ${
                        delimiter === d.id
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                          : 'bg-muted/40 hover:bg-muted text-foreground border-border/60'
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}

                  {delimiter === 'custom' && (
                    <Input
                      type="text"
                      placeholder="Nhập ký tự..."
                      value={customDelimiter}
                      onChange={(e) => handleCustomDelimChange(e.target.value)}
                      className="w-24 h-7 text-xs px-2"
                    />
                  )}
                </div>
              </div>

              <Textarea
                placeholder={`Ví dụ:\nHello - Xin chào\n你好 - Xin chào (Hệ thống tự điền Pinyin: nǐ hǎo)\nSerendipity - /ˌser.ənˈdɪp.ə.ti/ - Sự may mắn bất ngờ - It was pure [serendipity]\nGratitude - Lòng biết ơn - Expressing [gratitude] makes us happy`}
                value={importText}
                onChange={(e) => handleTextChange(e.target.value)}
                rows={6}
                className="font-mono text-xs bg-background leading-relaxed"
              />
            </div>
          )}

          {/* Configuration Options */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-border/50 text-xs">
            <div className="space-y-1.5">
              <span className="font-semibold text-muted-foreground">Cấu trúc khi có 3 cột:</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleThreeColChange('phonetic-first')}
                  className={`flex-1 p-2 rounded-lg border text-left transition ${
                    threeColMode === 'phonetic-first'
                      ? 'border-indigo-500 bg-indigo-500/10 text-foreground font-medium'
                      : 'border-border/60 bg-muted/20 text-muted-foreground'
                  }`}
                >
                  <p className="font-semibold text-foreground">Từ - Phiên âm - Nghĩa</p>
                  <p className="text-[10px] text-muted-foreground">Khuyên dùng cho Tiếng Trung / IPA</p>
                </button>
                <button
                  type="button"
                  onClick={() => handleThreeColChange('definition-first')}
                  className={`flex-1 p-2 rounded-lg border text-left transition ${
                    threeColMode === 'definition-first'
                      ? 'border-indigo-500 bg-indigo-500/10 text-foreground font-medium'
                      : 'border-border/60 bg-muted/20 text-muted-foreground'
                  }`}
                >
                  <p className="font-semibold text-foreground">Từ - Định nghĩa - Ví dụ</p>
                  <p className="text-[10px] text-muted-foreground">Dành cho bộ thẻ không cần phiên âm</p>
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <span className="font-semibold text-muted-foreground">Tùy chọn nhập:</span>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={autoPinyin}
                    onChange={(e) => {
                      setAutoPinyin(e.target.checked)
                      if (activeTab === 'excel' && file) handleProcessFile(file)
                      else if (activeTab === 'text') handleParseText(importText, customDelimiter, delimiter)
                    }}
                    className="rounded border-border text-indigo-600 focus:ring-indigo-500 size-4"
                  />
                  <span className="text-foreground font-medium flex items-center gap-1">
                    <Wand2 className="size-3 text-indigo-500" /> Tự động sinh Pinyin cho chữ Hán nếu thiếu
                  </span>
                </label>

                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 cursor-pointer text-muted-foreground">
                    <input
                      type="radio"
                      name="importMode"
                      value="append"
                      checked={importMode === 'append'}
                      onChange={() => setImportMode('append')}
                      className="text-indigo-600 focus:ring-indigo-500 size-3.5"
                    />
                    <span>Thêm vào thẻ hiện tại ({existingCount})</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer text-muted-foreground">
                    <input
                      type="radio"
                      name="importMode"
                      value="replace"
                      checked={importMode === 'replace'}
                      onChange={() => setImportMode('replace')}
                      className="text-indigo-600 focus:ring-indigo-500 size-3.5"
                    />
                    <span>Thay thế toàn bộ</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive flex items-center gap-2 text-xs">
              <AlertCircle className="size-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Live Preview Section */}
          {parsedCards.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-border/60">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-foreground">Xem trước danh sách thẻ</span>
                  <Badge variant="success" className="gap-1">
                    <Check className="size-3" /> Đã nhận diện: {parsedCards.length} thẻ
                  </Badge>
                </div>
                <span className="text-xs text-muted-foreground">Hiển thị tối đa 15 thẻ đầu tiên</span>
              </div>

              <div className="border border-border/70 rounded-xl overflow-hidden bg-background">
                <div className="overflow-x-auto max-h-56">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-muted/60 text-muted-foreground font-semibold sticky top-0 border-b border-border/60">
                      <tr>
                        <th className="p-2.5 w-10 text-center">#</th>
                        <th className="p-2.5 w-1/4">Thuật ngữ</th>
                        <th className="p-2.5 w-1/5">Phiên âm</th>
                        <th className="p-2.5 w-1/3">Định nghĩa</th>
                        <th className="p-2.5">Câu ví dụ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {parsedCards.slice(0, 15).map((card, idx) => (
                        <tr key={idx} className="hover:bg-muted/20 transition">
                          <td className="p-2 text-center text-muted-foreground font-mono text-[11px]">
                            {idx + 1}
                          </td>
                          <td className="p-2 font-medium text-foreground">{card.term}</td>
                          <td className="p-2 text-indigo-600 dark:text-indigo-400 font-mono">
                            {card.phonetic || <span className="text-muted-foreground/50">-</span>}
                          </td>
                          <td className="p-2 text-foreground">{card.definition}</td>
                          <td className="p-2 text-muted-foreground italic text-[11px]">
                            {card.example_sentence || <span className="text-muted-foreground/40">-</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {parsedCards.length > 15 && (
                  <div className="p-2 bg-muted/30 text-center text-[11px] text-muted-foreground border-t border-border/50">
                    ...và {parsedCards.length - 15} thẻ khác sẽ được nhập
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border/70 bg-muted/20">
          <div className="text-xs text-muted-foreground">
            {parsedCards.length > 0 ? (
              <span>
                Sẽ {importMode === 'append' ? 'thêm' : 'thay thế thành'}{' '}
                <strong className="text-foreground">{parsedCards.length} thẻ</strong> vào học phần
              </span>
            ) : (
              <span>Chưa có thẻ nào sẵn sàng</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>
              Hủy
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={parsedCards.length === 0}
              onClick={handleConfirmImport}
              className="gap-1.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-medium shadow-md shadow-indigo-500/20"
            >
              <Sparkles className="size-3.5" />
              Nhập {parsedCards.length > 0 ? `${parsedCards.length} thẻ` : 'vào bộ thẻ'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
