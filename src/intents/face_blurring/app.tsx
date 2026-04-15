import
{
	Box,
	Button,
	Rows,
	Text,
	Title,
	ProgressBar,
	Alert,
	Link,
} from "@canva/app-ui-kit";
import { auth } from "@canva/user";
import { addElementAtPoint } from "@canva/design";
import React, { useState, useEffect, useRef } from "react";
import { useSelection } from "./utils/use_selection_hook";
import { upload, getTemporaryUrl } from "@canva/asset";
import * as styles from "styles/components.css";
import { FormattedMessage, useIntl } from "react-intl";
import { requestOpenExternalUrl } from "@canva/platform";
import type { ImageRef, VideoRef, ImageMimeType, VideoMimeType, } from "@canva/asset";

const FACE_BLURRING_URL = "https://canva-videoptimize.univ-grenoble-alpes.fr/";		// en production

const isDev = window.location.hostname.endsWith("canva-apps.com");
const BACKEND_URL = isDev
  ? `${BACKEND_HOST}/api/download` // backend local en mode test
  : "https://canva-videoptimize.univ-grenoble-alpes.fr/api/download"; // backend Debian en production

const CLEANUP_URL = isDev
  ? `${BACKEND_HOST}/api/cleanup` // backend local en mode test
  : "http://canva-videoptimize.univ-grenoble-alpes.fr/api/cleanup"; // backend Debian en production
  
type MyProcessState = "idle" | "loading" | "success" | "error";

type MediaType = "image" | "video";
type AppError = {
	title: string;
	message: string;
};

export function App()
{
	const intl = useIntl();
	const imageSelection = useSelection("image");
	const videoSelection = useSelection("video");
	const isImageSelected = imageSelection.count > 0;
	const isVideoSelected = videoSelection.count > 0;
	const [userId, setUserId] = useState<string | null>(null);
	const [mediaUrl, setMediaUrl] = useState<string | null>(null);
	const [mediaType, setMediaType] = useState<MediaType>("image");
	const [mediaMimeType, setMediaMimeType] = useState<string>("");
	const [processState, setProcessState] = useState<MyProcessState>("idle");
	const [contentRef, setContentRef] = useState<string>("");
	const [progress, setProgress] = useState<number>(0);
	const [progressTitle, setProgressTitle] = useState<React.ReactNode>(null);
	const abortControllerRef = useRef<AbortController | null>(null);
	const [isCanceled, setIsCanceled] = useState(false);
	const [alert, setAlert] = useState({ title: "", message: "", show: false });
	
	// utilisation de console_log dans le frontend :
	// F12 dans la page web, onglet Sources
	// chercher le frame : app-xxxx.canva-apps.com
	// cliquer dessus
	// ==> on voit les messages console.log dans l'onglet Console > user messages
	// console.log(`BACKEND_URL = ` , BACKEND_URL);

	useEffect(() =>
	{
		//console.log("Media URL updated:", mediaUrl);
	}, [mediaUrl]);

	useEffect(() =>
	{
		//console.log("Image selection changed:", imageSelection);
		//console.log("Video selection changed:", videoSelection);
		if (processState !== "loading" && (isImageSelected || isVideoSelected))
		{
			handleClick();
		}
	}, [imageSelection, videoSelection]);

	const fetchUserId = async () =>
	{
		try
		{
			// MODE DEV : Canva ne fournit pas de token
			if (isDev)
			{
				return "dev-user";
			}

			// MODE PROD : logique Canva normale
			const token = await auth.getCanvaUserToken();
			if (!token)
			{
				throw new Error("User is not authenticated");
			}

			const res = await fetch(BACKEND_URL, {
				headers: {
					Authorization: `Bearer ${token}`,
				},
			});

			if (res.ok)
			{
				const body = await res.json();
				return body.userId;
			}
			else if (res.status === 401)
			{
				throw new Error("User is not authenticated");
			}
			else
			{
				throw new Error("Failed to fetch user ID");
			}
		}
		catch (error: unknown)
		{
			if (error instanceof Error)
			{
				if (error.message === "User is not authenticated")
				{
					handleError({
						title: "User is not authenticated.",
						message: "Please log in to Canva to use this app."
					});
				}
				else
				{
					handleError({
						title: "Server error",
						message: error.message
					});
				}
			}
			else
			{
				handleError({
					title: "Server is down!",
					message: "Face Blurring can't be used."
				});
			}

			// Toujours retourner quelque chose pour éviter result = undefined
			return { error: true };
		}
	};

	useEffect(() =>
	{
		const initialize = async () =>
		{
			const result = await fetchUserId();

			if (result.error)
			{
				handleError({
					title: "User error",
					message: result.error
				});
			} else
			{
				setUserId(result);
			}
		};

		initialize();
	}, []);

	const openExternalUrl = async (url: string) =>
	{
		const response = await requestOpenExternalUrl({
			url,
		});

		if (response.status === "aborted")
		{
		}
	};

	const resetMediaState = () =>
	{
		setMediaUrl(null);
		setMediaType("image");
		setMediaMimeType("");
		setContentRef("");
		setProgress(0);
		setProgressTitle("");
		setIsCanceled(false);
		abortControllerRef.current = null;
	};

	const handleError = (error: AppError) =>
	{
		if (!isCanceled)
		{
			//console.error("Error occurred:", error);
		}
		const title = error.title || "Error.";
		const message = error.message || "Something went wrong.";
		setAlert({ title, message, show: true });
		setProcessState("error");
		resetMediaState();
	};

	async function cleanupFiles(originalFilename: string, isVideo = false)
	{
		try
		{
			const token = await auth.getCanvaUserToken();
			if (!token)
			{
				throw new Error("User is not authenticated");
			}
			const response = await fetch(CLEANUP_URL, {
				method: "POST",
				headers: {
					Authorization: `Bearer ${token}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					originalFilename: originalFilename,
					isVideo: isVideo,
				}),
			});
			if (response.status === 401)
			{
				throw new Error("User is not authenticated");
			}
			if (!response.ok)
			{
				const errorText = await response.text();
				//console.error("Cleanup failed:", errorText);
				throw new Error("Cleanup failed: " + errorText);
			}
			//console.log("Media cleaned up.");
		} catch (error: unknown)
		{
			if (error instanceof Error)
			{
				if (error.message === "User is not authenticated")
				{
					handleError({ title: "User is not authenticated.", message: "Please log in to Canva to use this app." });
				}
				else
				{
					// Erreur non-Error (rare mais possible) 
					handleError({
						title: "Unexpected error",
						message: "An unknown error occurred."
					});
				}
			}
		}
	}

	async function handleClick()
	{
		if (!isImageSelected && !isVideoSelected)
		{
			handleError({ title: "Bad selection.", message: "Please (re-)select an image or video first." });
			resetMediaState();
			setProcessState("idle");
			return;
		}
		setProcessState("idle");

		try
		{
			//console.log("isImageSelected:", isImageSelected);
			//console.log("isVideoSelected:", isVideoSelected);
			//console.log("Media selected.");
			const draft = isImageSelected ? await imageSelection.read() : await videoSelection.read();
			//console.log("Draft contents:", draft.contents);

			for (const content of draft.contents)
			{
				const contentType = isImageSelected ? "image" : "video";
				//console.log("Content Ref:", content.ref, "Content Type:", contentType);
				setContentRef(content.ref);

				if (contentType === "image")
				{
					const imageRef = content.ref as ImageRef;

					const { url } = await getTemporaryUrl({ // récupère l'URL de l'image originale
						type: "image",
						ref: imageRef,
					});
				} else
				{
					const videoRef = content.ref as VideoRef;

					const { url } = await getTemporaryUrl({
						type: "video",
						ref: videoRef,
					});
				}

				//console.log("Temporary URL:", url);
				if (!isImageSelected)
				{
					const videoRef = content.ref as VideoRef;
					const { url } = await getTemporaryUrl({ type: "video", ref: videoRef, });
					const videoBlob = await (await fetch(url)).blob();
					//console.log("videoBlob.type:", videoBlob.type);

					const videoURL = URL.createObjectURL(videoBlob);
					const videoElement = document.createElement("video");
					videoElement.src = videoURL;
					await new Promise((resolve, reject) =>
					{
						videoElement.onloadedmetadata = () =>
						{
							const duration = videoElement.duration; // duration in seconds
							URL.revokeObjectURL(videoURL); // Clean up the URL to release memory
							resolve(duration);
						};
						videoElement.onerror = (e) =>
						{
							URL.revokeObjectURL(videoURL); // Clean up on error
							reject(e);
						};
					});
					if (videoElement.duration > 10)
					{
						//console.log("Video duration exceeds limit:", videoElement.duration, "seconds");
						handleError({ title: "This video is too long.", message: "Try using a video that’s shorter than 10 seconds." });
						return;
					}

					setMediaUrl(url);
					setMediaType("video");
					setMediaMimeType(videoBlob.type);
				}
				else
				{
					const imageRef = content.ref as ImageRef;
					const { url } = await getTemporaryUrl({ type: "image", ref: imageRef, });
					const imageBlob = await (await fetch(url)).blob();
					//console.log("imageBlob.type:", imageBlob.type);
					setMediaUrl(url);
					setMediaType("image");
					setMediaMimeType(imageBlob.type);
				}
			}
		} catch (error: unknown)
		{
			if (error instanceof Error)
			{
				if (error.message === "NetworkError when attempting to fetch resource.")
				{
					handleError({ title: "Unable to blur faces in the selected media.", message: "Use imported images or videos from your own library." });
				}
			} else
			{
				handleError({ title: "Unexpected error.", message: "Sorry, we had trouble processing your media. Please try again." });
			}
		}
	}
//-------------------------------------------------------------------------
// Le user a cliqué sur le bouton "Blur faces"
//-------------------------------------------------------------------------
	const handleProcessClick = async () =>
	{
		if (!mediaUrl)
		{
			handleError({ title: "Bad selection.", message: "Please (re-)select an image or video first." });
			return;
		}

		// Initialize AbortController
		abortControllerRef.current = new AbortController();
		setProcessState("loading");
		setProgress(25);
		setProgressTitle(<FormattedMessage
			defaultMessage="Downloading and processing selected media..."
			description="This is a progress bar title label, indicating the loading step of the process."
		/>);

		try
		{
			const token = await auth.getCanvaUserToken();
			if (!token)
			{
				throw new Error("User is not authenticated");
			}

			// On envoie directement l’URL Canva au backend
			const payload =
			{
				sourceUrl: mediaUrl,                 // URL temporaire Canva
				userId: userId || "unknown_user",
				mediaType: mediaType,               // "image" ou "video"
				// éventuellement mediaMimeType si le backend en a besoin
			};

			const resProcess = await fetch(BACKEND_URL,    
			{
				method: "POST",
				headers:
				{
					Authorization: `Bearer ${token}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify(payload),
				signal: abortControllerRef.current.signal,
			});

			if (resProcess.status === 401)
			{
				throw new Error("User is not authenticated");
			}
			if (isCanceled)
			{
				// Handle if cancelled during processing
				return;
			}
			if (!resProcess.ok)
			{
				const errorText = await resProcess.text();
				throw new Error("Download or process failed: " + errorText);
			}

			const resJson = await resProcess.json();

			if ((resProcess.ok) && (resJson.facesDetected === 0))
			{
				throw new Error("No faces detected");
			}

			setProgress(50);
			setProgressTitle(<FormattedMessage
				defaultMessage="Uploading processed media to library..."
				description="This is a progress bar title label, indicating the uploading step of the process."
			/>);

			// Add an image asset to the user's library
			if (mediaType == "image")
			{

				console.log("URL envoyée à Canva pour upload vers backend:", resJson.fileUrl);

				// ⚠ Important : mimeType doit correspondre au fichier renvoyé par le backend
				// Si ton backend renvoie toujours du JPEG, mets "image/jpeg" en dur
				const resUpload = await upload({
					type: "image",
					mimeType: "image/jpeg" as ImageMimeType,   // ou resJson.mimeType si tu l’ajoutes côté backend
					url: resJson.fileUrl,                     // URL publique de ton backend
					thumbnailUrl: resJson.thumbnailFileUrl,
					aiDisclosure: "none",
					width: 100,
					height: 100,
				});

				await resUpload.whenUploaded().catch((error) =>
				{
					handleError(error);
					return;
				});

				setProgress(75);
				setProgressTitle(<FormattedMessage
					defaultMessage="Adding processed media to design..."
					description="This is a progress bar title label, indicating the addding step of the process."
				/>);

				const draft = await imageSelection.read();
				if (draft.contents.length > 0)
				{
					for (const content of draft.contents)
					{
						content.ref = resUpload.ref;
					}
					await draft.save();
				}
				else
				{
					await addElementAtPoint({
						type: "image",
						ref: resUpload.ref,
						altText: undefined,
					});
				}

				// Clean up Files
				// Fait du côté backend
			}
			else
			{
				if (mediaType == "video")
				{
					const videoRef = contentRef as VideoRef;

					const resUpload = await upload({
						type: "video",
						mimeType: "video/mp4" as VideoMimeType,   // à adapter selon ton backend
						url: resJson.fileUrl,
						thumbnailVideoUrl: resJson.thumbnailFileUrl,
						thumbnailImageUrl: resJson.thumbnailFileUrl,
						aiDisclosure: "none",
						width: 100,
						height: 100,
					});

					await resUpload.whenUploaded().catch((error) =>
					{
						handleError(error);
						return;
					});

					setProgress(75);
					setProgressTitle(<FormattedMessage
						defaultMessage="Adding processed media to design..."
						description="This is a progress bar title label, indicating the adding step of the process."
					/>);

					const draft = await videoSelection.read();
					if (draft.contents.length > 0)
					{
						for (const content of draft.contents)
						{
							content.ref = resUpload.ref;
						}
						await draft.save();
					}
					else
					{
						await addElementAtPoint({
							type: "video",
							ref: resUpload.ref,
							altText: undefined,
						});
					}
				}
			}

			setProcessState("success");
			setProgress(100);
			setProgressTitle(<FormattedMessage
				defaultMessage="Media processed."
				description="This is a progress bar title label, indicating the end of the process."
			/>);
			resetMediaState();
		}
		catch (error: unknown)
		{
			if (error instanceof Error)
			{
				if (error.message === "User is not authenticated")
				{
					handleError({
						title: "User is not authenticated.",
						message: "Please log in to Canva to use this app."
					});
				}
				else if (error.message === "No faces detected")
				{
					handleError({
						title: "No faces detected.",
						message: "Please use an image or video with faces that are clearly visible."
					});
				}
				else if (!(error.name === "AbortError"))
				{
					handleError({
						title: "Unexpected error.",
						message: "Sorry, we had trouble processing your media. Please try again."
					});
				}
			}
			else
			{
				handleError({
					title: "Unexpected error.",
					message: "Sorry, we had trouble processing your media. Please try again."
				});
			}
		}
	};

	const handleCancelClick = () =>
	{
		if (abortControllerRef.current)
		{
			abortControllerRef.current.abort();
		}
		setIsCanceled(true);
		setProcessState("idle");
		resetMediaState();
	};

	const handleErrorDismissClick = () =>
	{
		setAlert({ title: "", message: "", show: false });
		setProcessState("idle");
		resetMediaState();
	};

	if (processState === "loading")
	{
		return (
			<div className={styles.scrollContainer}>
				<Box className={styles.default} height="full" display="flex" alignItems="center">
					<Rows spacing="3u">
						<Rows spacing="2u">
							<Title alignment="center" size="small">
								<FormattedMessage
									defaultMessage="Blurring faces"
									description="This is a title indicating that the selected media is being processed."
								/>
							</Title>
							<ProgressBar value={progress} ariaLabel={intl.formatMessage({
								defaultMessage: "Processing media...",
								description: "Label for progress bar display. Explains that the media is being processed",
							})}
							/>
							<Text alignment="center" tone="tertiary" size="xsmall">
								{progressTitle}
							</Text>
							{isVideoSelected &&
								<Text alignment="center" tone="tertiary" size="small">
									<FormattedMessage
										defaultMessage="Please wait, processing videos can take a little longer than images"
										description="This is a message indicating that video processing can take some time."
									/>
								</Text>
							}
						</Rows>
						<Button variant="secondary" onClick={handleCancelClick}>
							{intl.formatMessage({
								defaultMessage: "Cancel",
								description: "This is a button label indicating that the selected media process can be cancelled.",
							})}
						</Button>
					</Rows>
				</Box>
			</div>
		);
	}
	else
	{
		return (
			<div className={styles.scrollContainer}>
				<Rows spacing="1.5u">
					{(processState === "error") && alert.show && <Alert title={alert.title} tone="critical" onDismiss={handleErrorDismissClick}>{alert.message}</Alert>}
					<Rows spacing="0.5u">
						<Text variant="bold">
							<FormattedMessage
								defaultMessage="Select an image or video in your design"
								description="This is a sentence describing to the user how to use the app."
							/>
						</Text>
						<Text size="small" tone="tertiary">
							<FormattedMessage
								defaultMessage="Maximum video duration: 10 seconds"
								description="This is a message to inform that long duration videos would take too much time."
							/>
						</Text>
					</Rows>


					<Button
						variant="primary"
						disabled={(!isImageSelected && !isVideoSelected) || !mediaUrl}
						onClick={handleProcessClick}

						stretch
					>
						{intl.formatMessage({
							defaultMessage: "Blur faces",
							description: "This is a button label indicating that the selected media can be processed.",
						})}
					</Button>
					<Rows spacing="1.5u">
						<Text size="small" alignment="center" tone="tertiary">
							{intl.formatMessage({
								defaultMessage: "Created by Spooqs.",
								description: "Spooqs is the name of the company that developed this app.",
							})}

							&nbsp;
							<Link
								href={FACE_BLURRING_URL}
								id="id"
								requestOpenExternalUrl={() => openExternalUrl(FACE_BLURRING_URL)}
							// title="Spooqs"
							>
								{intl.formatMessage({
									defaultMessage: "Learn more",
									description: "This is a link label to open Spooqs homepage's URL.",
								})}
							</Link>
						</Text>
					</Rows>
				</Rows>
			</div>
		);
	}
}
