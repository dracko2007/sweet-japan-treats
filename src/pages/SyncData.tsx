import React, { useState } from 'react';
import { RefreshCw, Database, Cloud, AlertCircle, CheckCircle } from 'lucide-react';
import Layout from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { firebaseSyncService } from '@/services/firebaseSyncService';

const SyncData: React.FC = () => {
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<{ success: boolean; migrated?: number; error?: any } | null>(null);
  const [localUsers, setLocalUsers] = useState<number>(0);

  React.useEffect(() => {
    // Count local users
    const usersData = localStorage.getItem('sweet-japan-users');
    if (usersData) {
      const users = JSON.parse(usersData);
      setLocalUsers(Object.keys(users).length);
    }
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    setResult(null);

    try {
      const syncResult = await firebaseSyncService.migrateLocalStorageToFirestore();
      setResult(syncResult);
    } catch (error) {
      setResult({ success: false, error });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-6 w-6" />
              Sincronização de Dados
            </CardTitle>
            <CardDescription>
              Sincronize seus dados do localStorage para o Firebase Cloud
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Status atual */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-semibold text-blue-900">Status Atual</h3>
                  <p className="text-sm text-blue-700 mt-1">
                    Você tem <strong>{localUsers} usuário(s)</strong> armazenado(s) localmente neste dispositivo.
                  </p>
                </div>
              </div>
            </div>

            {/* Explicação */}
            <div className="space-y-3">
              <h3 className="font-semibold">O que é sincronização?</h3>
              <p className="text-sm text-gray-600">
                A sincronização envia seus dados do armazenamento local (localStorage) deste dispositivo
                para a nuvem do Firebase. Isso permite que você acesse seus dados de qualquer dispositivo.
              </p>
              <ul className="text-sm text-gray-600 space-y-2 list-disc list-inside">
                <li>Seus cadastros ficarão disponíveis em todos os dispositivos</li>
                <li>Os dados serão salvos com segurança na nuvem</li>
                <li>Não há risco de perder informações ao trocar de dispositivo</li>
              </ul>
            </div>

            {/* Botão de sincronização */}
            <Button
              onClick={handleSync}
              disabled={syncing || localUsers === 0}
              className="w-full"
              size="lg"
            >
              {syncing ? (
                <>
                  <RefreshCw className="mr-2 h-5 w-5 animate-spin" />
                  Sincronizando...
                </>
              ) : (
                <>
                  <Cloud className="mr-2 h-5 w-5" />
                  Sincronizar Dados
                </>
              )}
            </Button>

            {localUsers === 0 && (
              <p className="text-sm text-gray-500 text-center">
                Não há dados locais para sincronizar
              </p>
            )}

            {/* Resultado */}
            {result && (
              <div
                className={`rounded-lg p-4 ${
                  result.success
                    ? 'bg-green-50 border border-green-200'
                    : 'bg-red-50 border border-red-200'
                }`}
              >
                <div className="flex items-start gap-3">
                  {result.success ? (
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <h3
                      className={`font-semibold ${
                        result.success ? 'text-green-900' : 'text-red-900'
                      }`}
                    >
                      {result.success ? 'Sincronização Completa!' : 'Erro na Sincronização'}
                    </h3>
                    {result.success ? (
                      <p className="text-sm text-green-700 mt-1">
                        {result.migrated} usuário(s) foram sincronizados com sucesso!
                        <br />
                        Agora você pode fazer login em qualquer dispositivo.
                      </p>
                    ) : (
                      <p className="text-sm text-red-700 mt-1">
                        Ocorreu um erro durante a sincronização. Tente novamente mais tarde.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Informação adicional */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h3 className="font-semibold text-sm mb-2">📱 Cadastros Novos</h3>
              <p className="text-sm text-gray-600">
                A partir de agora, todos os novos cadastros serão automaticamente sincronizados
                com o Firebase. Você não precisará fazer sincronização manual novamente.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default SyncData;
