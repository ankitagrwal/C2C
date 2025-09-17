import { useState, useRef, useCallback } from 'react';
import { Upload, X, FileText, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import type { Document } from '@shared/schema';

interface UploadFile {
  id: string;
  file: File;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  progress: number;
  error?: string;
  document?: Document;
}

interface UploadStepProps {
  onComplete: (documents: Document[]) => void;
  initialDocuments?: Document[];
  docType?: string;
  customerId?: string | null;
}

const ALLOWED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain'
];

const ALLOWED_EXTENSIONS = ['.pdf', '.doc', '.docx', '.txt'];
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
const MAX_FILES = 5;

export default function UploadStep({ 
  onComplete, 
  initialDocuments = [], 
  docType = 'Business Document',
  customerId = null 
}: UploadStepProps) {
  const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const uploadWithProgress = async (files: File[]): Promise<{ documents: Document[]; count: number }> => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const formData = new FormData();
      
      // Append files to form data
      files.forEach(file => formData.append('documents', file));
      formData.append('docType', docType);
      if (customerId) {
        formData.append('customerId', customerId);
      }

      // Track progress for uploading files
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percentComplete = (event.loaded / event.total) * 100;
          
          // Update progress for all uploading files
          setUploadFiles(prev => prev.map(uploadFile => 
            uploadFile.status === 'uploading' 
              ? { ...uploadFile, progress: Math.round(percentComplete) }
              : uploadFile
          ));
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText);
            resolve(response);
          } catch (error) {
            reject(new Error('Invalid response format'));
          }
        } else {
          reject(new Error(xhr.responseText || xhr.statusText));
        }
      };

      xhr.onerror = () => {
        reject(new Error('Network error occurred'));
      };

      xhr.open('POST', '/api/documents/upload-batch');
      xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
      xhr.withCredentials = true;
      xhr.send(formData);
    });
  };

  const validateFile = (file: File): string | null => {
    if (file.size > MAX_FILE_SIZE) {
      return `File size exceeds 20MB limit (${(file.size / 1024 / 1024).toFixed(1)}MB)`;
    }

    const extension = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(extension)) {
      return `Unsupported file type. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`;
    }

    if (!ALLOWED_TYPES.includes(file.type) && file.type !== '') {
      // Allow files with empty type if extension is valid (some systems don't set MIME type)
      return `Invalid file format for ${file.name}`;
    }

    return null;
  };

  const processFiles = useCallback((files: FileList | File[]) => {
    const fileArray = Array.from(files);
    
    // Check total file limit
    if (uploadFiles.length + fileArray.length > MAX_FILES) {
      toast({
        title: 'Too Many Files',
        description: `Maximum ${MAX_FILES} files allowed. Currently have ${uploadFiles.length} files.`,
        variant: 'destructive',
      });
      return;
    }

    // Validate and add files
    const newUploadFiles: UploadFile[] = [];
    const validFiles: File[] = [];

    for (const file of fileArray) {
      // Check for duplicates
      const isDuplicate = uploadFiles.some(uf => uf.file.name === file.name && uf.file.size === file.size);
      if (isDuplicate) {
        toast({
          title: 'Duplicate File',
          description: `${file.name} is already selected`,
          variant: 'destructive',
        });
        continue;
      }

      const validationError = validateFile(file);
      
      const uploadFile: UploadFile = {
        id: `${file.name}-${Date.now()}`,
        file,
        status: validationError ? 'error' : 'pending',
        progress: 0,
        error: validationError || undefined
      };

      newUploadFiles.push(uploadFile);
      
      if (!validationError) {
        validFiles.push(file);
      }
    }

    if (newUploadFiles.length > 0) {
      setUploadFiles(prev => [...prev, ...newUploadFiles]);
    }

    return validFiles;
  }, [uploadFiles]); // Removed toast to prevent infinite loop

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      processFiles(files);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processFiles(files);
    }
    // Reset input to allow selecting same file again
    e.target.value = '';
  };

  const removeFile = (fileId: string) => {
    setUploadFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const clearAll = () => {
    setUploadFiles([]);
  };

  const startUpload = async () => {
    // Get files that are pending and valid for upload
    const filesToUpload = uploadFiles.filter(uf => uf.status === 'pending' && !uf.error);
    const files = filesToUpload.map(uf => uf.file);

    if (files.length === 0) {
      toast({
        title: 'No Valid Files',
        description: 'Please add at least one valid file to upload',
        variant: 'destructive',
      });
      return;
    }

    setIsUploading(true);

    // Update status to uploading for the files we're about to upload
    setUploadFiles(prev => prev.map(uf => 
      uf.status === 'pending' && !uf.error 
        ? { ...uf, status: 'uploading' as const, progress: 0 }
        : uf
    ));

    try {
      const data = await uploadWithProgress(files);
      
      // Create a mapping of uploaded files to returned documents
      // The documents are returned in the same order as the files were sent
      const uploadedFileIds = filesToUpload.map(uf => uf.id);
      
      // Update only the files that were uploaded with their corresponding documents
      setUploadFiles(prev => prev.map(uploadFile => {
        const uploadIndex = uploadedFileIds.indexOf(uploadFile.id);
        if (uploadIndex !== -1 && uploadFile.status === 'uploading') {
          return {
            ...uploadFile,
            status: 'completed' as const,
            progress: 100,
            document: data.documents[uploadIndex]
          };
        }
        return uploadFile;
      }));

      toast({
        title: 'Upload Successful',
        description: `Successfully uploaded ${data.count} document${data.count !== 1 ? 's' : ''}`,
      });

      // Pass completed documents to wizard
      onComplete(data.documents);
    } catch (error: any) {
      const errorMessage = error?.message || 'Failed to upload documents';
      
      // Update status to error for files that were being uploaded
      setUploadFiles(prev => prev.map(uploadFile => 
        uploadFile.status === 'uploading'
          ? { ...uploadFile, status: 'error' as const, error: errorMessage }
          : uploadFile
      ));

      toast({
        title: 'Upload Failed',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };

  // Count only pending files without errors for button text and enable logic
  const pendingValidFilesCount = uploadFiles.filter(f => f.status === 'pending' && !f.error).length;
  const hasErrors = uploadFiles.some(f => f.status === 'error' && !f.document);
  const canUpload = pendingValidFilesCount > 0 && !isUploading;

  return (
    <div className="space-y-6">
      {/* Upload Area */}
      <Card 
        className={`transition-colors ${isDragOver ? 'border-primary bg-primary/5' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <CardContent className="p-8">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-chart-3/10 flex items-center justify-center">
              <Upload className="w-8 h-8 text-chart-3" />
            </div>
            
            <div>
              <h3 className="text-lg font-medium mb-2">Upload Your Documents</h3>
              <p className="text-muted-foreground mb-4">
                Drag and drop files here or click to browse
              </p>
              <p className="text-xs text-muted-foreground">
                Supported formats: PDF, DOC, DOCX, TXT • Max {MAX_FILES} files • 20MB per file
              </p>
            </div>

            <Button 
              onClick={() => fileInputRef.current?.click()} 
              variant="outline"
              data-testid="button-browse-files"
            >
              <Upload className="w-4 h-4 mr-2" />
              Browse Files
            </Button>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={ALLOWED_EXTENSIONS.join(',')}
              onChange={handleFileSelect}
              className="hidden"
              data-testid="input-file-upload"
            />
          </div>
        </CardContent>
      </Card>

      {/* File List */}
      {uploadFiles.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-medium">
                Selected Files ({uploadFiles.length}/{MAX_FILES})
              </h4>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={clearAll}
                data-testid="button-clear-all"
              >
                Clear All
              </Button>
            </div>

            <div className="space-y-3">
              {uploadFiles.map((uploadFile) => (
                <div 
                  key={uploadFile.id}
                  className="flex items-center space-x-3 p-3 border rounded-lg"
                  data-testid={`file-item-${uploadFile.file.name}`}
                >
                  <FileText className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium truncate">
                        {uploadFile.file.name}
                      </p>
                      <Badge 
                        variant={
                          uploadFile.status === 'completed' ? 'default' :
                          uploadFile.status === 'error' ? 'destructive' :
                          uploadFile.status === 'uploading' ? 'secondary' : 
                          'outline'
                        }
                        data-testid={`badge-status-${uploadFile.file.name}`}
                      >
                        {uploadFile.status === 'completed' && <CheckCircle className="w-3 h-3 mr-1" />}
                        {uploadFile.status === 'error' && <AlertCircle className="w-3 h-3 mr-1" />}
                        {uploadFile.status === 'uploading' && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                        
                        {uploadFile.status === 'completed' ? 'Completed' :
                         uploadFile.status === 'error' ? 'Error' :
                         uploadFile.status === 'uploading' ? 'Uploading' : 
                         'Ready'}
                      </Badge>
                    </div>
                    
                    <p className="text-xs text-muted-foreground">
                      {(uploadFile.file.size / 1024 / 1024).toFixed(1)} MB
                    </p>
                    
                    {uploadFile.error && (
                      <p className="text-xs text-destructive mt-1">
                        {uploadFile.error}
                      </p>
                    )}
                    
                    {uploadFile.status === 'uploading' && (
                      <Progress 
                        value={uploadFile.progress} 
                        className="mt-2 h-1"
                        data-testid={`progress-${uploadFile.file.name}`}
                      />
                    )}
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFile(uploadFile.id)}
                    className="flex-shrink-0"
                    data-testid={`button-remove-${uploadFile.file.name}`}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>

            {hasErrors && (
              <Alert className="mt-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Some files have validation errors. Please fix or remove them before uploading.
                </AlertDescription>
              </Alert>
            )}

            <div className="mt-6 pt-4 border-t">
              <Button
                onClick={startUpload}
                disabled={!canUpload}
                className="w-full"
                data-testid="button-start-upload"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Uploading {pendingValidFilesCount} file{pendingValidFilesCount !== 1 ? 's' : ''}...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Upload {pendingValidFilesCount} file{pendingValidFilesCount !== 1 ? 's' : ''}
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Initial Documents Display */}
      {initialDocuments.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h4 className="font-medium mb-4">Previously Uploaded Documents</h4>
            <div className="space-y-2">
              {initialDocuments.map(doc => (
                <div key={doc.id} className="flex items-center space-x-3 p-2 border rounded">
                  <FileText className="w-4 h-4 text-chart-2" />
                  <span className="text-sm font-medium flex-1">{doc.filename}</span>
                  <Badge variant="default">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Uploaded
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}