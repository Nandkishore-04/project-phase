import { useState, useCallback } from 'react';
import { Upload, FileText, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import toast from 'react-hot-toast';
import api from '../services/api';

interface UploadedFile {
  file: File;
  preview: string;
  status: 'pending' | 'processing' | 'success' | 'error';
  message?: string;
}

export default function Invoices() {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [processing, setProcessing] = useState(false);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles = acceptedFiles.map(file => ({
      file,
      preview: URL.createObjectURL(file),
      status: 'pending' as const,
    }));
    setFiles(prev => [...prev, ...newFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg'],
      'application/pdf': ['.pdf'],
    },
    maxSize: 10485760, // 10MB
  });

  const processFiles = async () => {
    if (files.length === 0) {
      toast.error('Please upload at least one invoice');
      return;
    }

    setProcessing(true);

    for (let i = 0; i < files.length; i++) {
      if (files[i].status !== 'pending') continue;

      setFiles(prev =>
        prev.map((f, idx) =>
          idx === i ? { ...f, status: 'processing' } : f
        )
      );

      try {
        const formData = new FormData();
        formData.append('invoice', files[i].file);

        await api.uploadInvoice(formData);

        setFiles(prev =>
          prev.map((f, idx) =>
            idx === i
              ? { ...f, status: 'success', message: 'Invoice processed successfully' }
              : f
          )
        );

        toast.success(`${files[i].file.name} processed successfully`);
      } catch (error: any) {
        setFiles(prev =>
          prev.map((f, idx) =>
            idx === i
              ? {
                  ...f,
                  status: 'error',
                  message: error.response?.data?.error || 'Processing failed',
                }
              : f
          )
        );

        toast.error(`Failed to process ${files[i].file.name}`);
      }
    }

    setProcessing(false);
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, idx) => idx !== index));
  };

  const clearAll = () => {
    setFiles([]);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Invoice Processing
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Upload and process purchase invoices with AI-powered OCR
        </p>
      </div>

      {/* Upload Area */}
      <div className="card p-8">
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
            isDragActive
              ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/10'
              : 'border-gray-300 dark:border-gray-700 hover:border-primary-400 dark:hover:border-primary-600'
          }`}
        >
          <input {...getInputProps()} />
          <Upload
            className={`mx-auto mb-4 ${
              isDragActive ? 'text-primary-600' : 'text-gray-400'
            }`}
            size={48}
          />
          <p className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            {isDragActive
              ? 'Drop invoices here...'
              : 'Drag & drop invoices here, or click to browse'}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Supports PDF, JPG, PNG (Max 10MB per file)
          </p>
        </div>
      </div>

      {/* Uploaded Files */}
      {files.length > 0 && (
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Uploaded Files ({files.length})
            </h2>
            <div className="flex gap-2">
              <button
                onClick={clearAll}
                className="btn-secondary text-sm"
                disabled={processing}
              >
                Clear All
              </button>
              <button
                onClick={processFiles}
                className="btn-primary text-sm"
                disabled={processing || files.every(f => f.status !== 'pending')}
              >
                {processing ? (
                  <>
                    <Loader2 className="animate-spin mr-2" size={16} />
                    Processing...
                  </>
                ) : (
                  'Process Invoices'
                )}
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {files.map((fileItem, index) => (
              <div
                key={index}
                className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg"
              >
                {/* File Preview */}
                <div className="flex-shrink-0">
                  {fileItem.file.type.startsWith('image/') ? (
                    <img
                      src={fileItem.preview}
                      alt="Preview"
                      className="w-16 h-16 object-cover rounded"
                    />
                  ) : (
                    <div className="w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded flex items-center justify-center">
                      <FileText className="text-gray-500" size={32} />
                    </div>
                  )}
                </div>

                {/* File Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 dark:text-white truncate">
                    {fileItem.file.name}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {(fileItem.file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                  {fileItem.message && (
                    <p
                      className={`text-sm mt-1 ${
                        fileItem.status === 'error'
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-green-600 dark:text-green-400'
                      }`}
                    >
                      {fileItem.message}
                    </p>
                  )}
                </div>

                {/* Status Icon */}
                <div className="flex-shrink-0">
                  {fileItem.status === 'pending' && (
                    <button
                      onClick={() => removeFile(index)}
                      className="text-gray-400 hover:text-red-600"
                      disabled={processing}
                    >
                      <XCircle size={24} />
                    </button>
                  )}
                  {fileItem.status === 'processing' && (
                    <Loader2 className="text-blue-600 animate-spin" size={24} />
                  )}
                  {fileItem.status === 'success' && (
                    <CheckCircle className="text-green-600" size={24} />
                  )}
                  {fileItem.status === 'error' && (
                    <XCircle className="text-red-600" size={24} />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Info Card */}
      <div className="card p-6 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800">
        <h3 className="font-bold text-blue-900 dark:text-blue-100 mb-2">
          📋 How it works
        </h3>
        <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1 list-disc list-inside">
          <li>Upload invoice PDFs or images</li>
          <li>AI extracts supplier, items, quantities, prices, and GST details</li>
          <li>Review and edit extracted data before saving</li>
          <li>Inventory is automatically updated after approval</li>
        </ul>
      </div>
    </div>
  );
}
