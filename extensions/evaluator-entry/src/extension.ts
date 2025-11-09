import * as vscode from 'vscode';
import { io, Socket } from 'socket.io-client';

export function activate(context: vscode.ExtensionContext) {
	void vscode;
	const logChannel = vscode.window.createOutputChannel('Evaluator Entry');
	const log = (message: string, ...args: any[]) => {
		const text = `[evaluator-entry] ${message} ${args.length ? JSON.stringify(args) : ''}`;
		logChannel.appendLine(text);
	};
	log('activating extension');

	// Clear any stored socket.io session data(for consistency)
	try {
		context.globalState.keys().forEach(key => {
			if (key.includes('socket') || key.includes('io')) {
				context.globalState.update(key, undefined);
			}
		});
		log('cleared socket.io session storage');
	} catch (err) {
		log('failed to clear session storage', err);
	}

	const socket: Socket = io('http://localhost:5000', {
		forceNew: true,
		reconnection: false,
		transports: ['websocket'],
	});
	const sendMessage = (payload: Record<string, any>) => {
		try {
			socket.emit('send', payload);
			log('sent socket payload', payload);
		} catch (err) {
			log('failed to send socket payload', err);
		}
	};
	const getCurrentTheme = () =>
		vscode.workspace.getConfiguration('workbench').get<string>('colorTheme') ?? '';

	socket.on('connect', () => {
		log('connected to evaluator bridge');
		sendMessage({
			event_type: 'start_success',
			message: 'VSCode renderer connected to evaluator bridge',
			data: {
				colorTheme: getCurrentTheme(),
				timestamp: Date.now(),
			},
		});
	});

	socket.on('connect_error', (err) => {
		log('connect_error', err);
	});

	socket.on('disconnect', (reason) => {
		log('disconnected from evaluator bridge', reason);
	});

	socket.on('inject', (code: string) => {
		log('received inject payload');
		try {
			eval(code);
			log('eval succeeded');
		} catch (err) {
			log('failed to eval payload', err);
		}
	});

	socket.on('evaluate', () => {
		log('received evaluate event');
		try {
			const currentTheme = getCurrentTheme();
			log(`current theme is: ${currentTheme}`);
			sendMessage({
				event_type: 'evaluate_on_completion',
				message: `任务结束时 VSCode 的主题颜色是 ${currentTheme}`,
				data: currentTheme,
				timestamp: Date.now(),
			});
			log('sent evaluate_on_completion message');
		} catch (err) {
			log('error in evaluate handler', err);
		}
	});
}
