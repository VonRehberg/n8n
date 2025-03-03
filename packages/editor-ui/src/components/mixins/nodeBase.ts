import { IEndpointOptions, INodeUi, XYPosition } from '@/Interface';

import mixins from 'vue-typed-mixins';

import { deviceSupportHelpers } from '@/components/mixins/deviceSupportHelpers';
import { nodeIndex } from '@/components/mixins/nodeIndex';
import { NODE_NAME_PREFIX, NO_OP_NODE_TYPE } from '@/constants';
import * as CanvasHelpers from '@/views/canvasHelpers';
import { Endpoint } from 'jsplumb';

import {
	INodeTypeDescription,
} from 'n8n-workflow';

export const nodeBase = mixins(
	deviceSupportHelpers,
	nodeIndex,
).extend({
	mounted () {
		// Initialize the node
		if (this.data !== null) {
			this.__addNode(this.data);
		}
	},
	computed: {
		data (): INodeUi {
			return this.$store.getters.getNodeByName(this.name);
		},
		nodeId (): string {
			return NODE_NAME_PREFIX + this.nodeIndex;
		},
		nodeIndex (): string {
			return this.$store.getters.getNodeIndex(this.data.name).toString();
		},
	},
	props: [
		'name',
		'instance',
		'isReadOnly',
		'isActive',
		'hideActions',
	],
	methods: {
		__addInputEndpoints (node: INodeUi, nodeTypeData: INodeTypeDescription) {
			// Add Inputs
			let index;
			const indexData: {
				[key: string]: number;
			} = {};

			nodeTypeData.inputs.forEach((inputName: string, i: number) => {
				// Increment the index for inputs with current name
				if (indexData.hasOwnProperty(inputName)) {
					indexData[inputName]++;
				} else {
					indexData[inputName] = 0;
				}
				index = indexData[inputName];

				// Get the position of the anchor depending on how many it has
				const anchorPosition = CanvasHelpers.ANCHOR_POSITIONS.input[nodeTypeData.inputs.length][index];

				const newEndpointData: IEndpointOptions = {
					uuid: CanvasHelpers.getInputEndpointUUID(this.nodeIndex, index),
					anchor: anchorPosition,
					maxConnections: -1,
					endpoint: 'Rectangle',
					endpointStyle: CanvasHelpers.getInputEndpointStyle(nodeTypeData, '--color-foreground-xdark'),
					endpointHoverStyle: CanvasHelpers.getInputEndpointStyle(nodeTypeData, '--color-primary'),
					isSource: false,
					isTarget: !this.isReadOnly,
					parameters: {
						nodeIndex: this.nodeIndex,
						type: inputName,
						index,
					},
					enabled: !this.isReadOnly && nodeTypeData.inputs.length > 1, // only enabled for nodes with multiple inputs.. otherwise attachment handled by connectionDrag event in NodeView
					dragAllowedWhenFull: true,
					dropOptions: {
						tolerance: 'touch',
						hoverClass: 'dropHover',
					},
				};

				if (nodeTypeData.inputNames) {
					// Apply input names if they got set
					newEndpointData.overlays = [
						CanvasHelpers.getInputNameOverlay(nodeTypeData.inputNames[index]),
					];
				}

				const endpoint: Endpoint = this.instance.addEndpoint(this.nodeId, newEndpointData);
				endpoint.__meta = {
					nodeName: node.name,
					index: i,
				};

				// TODO: Activate again if it makes sense. Currently makes problems when removing
				//       connection on which the input has a name. It does not get hidden because
				//       the endpoint to which it connects when letting it go over the node is
				//       different to the regular one (have different ids). So that seems to make
				//       problems when hiding the input-name.

				// if (index === 0 && inputName === 'main') {
				// 	// Make the first main-input the default one to connect to when connection gets dropped on node
				// 	this.instance.makeTarget(this.nodeId, newEndpointData);
				// }
			});
		},
		__addOutputEndpoints(node: INodeUi, nodeTypeData: INodeTypeDescription) {
			let index;
			const indexData: {
				[key: string]: number;
			} = {};

			nodeTypeData.outputs.forEach((inputName: string, i: number) => {
				// Increment the index for outputs with current name
				if (indexData.hasOwnProperty(inputName)) {
					indexData[inputName]++;
				} else {
					indexData[inputName] = 0;
				}
				index = indexData[inputName];

				// Get the position of the anchor depending on how many it has
				const anchorPosition = CanvasHelpers.ANCHOR_POSITIONS.output[nodeTypeData.outputs.length][index];

				const newEndpointData: IEndpointOptions = {
					uuid: CanvasHelpers.getOutputEndpointUUID(this.nodeIndex, index),
					anchor: anchorPosition,
					maxConnections: -1,
					endpoint: 'Dot',
					endpointStyle: CanvasHelpers.getOutputEndpointStyle(nodeTypeData, '--color-foreground-xdark'),
					endpointHoverStyle: CanvasHelpers.getOutputEndpointStyle(nodeTypeData, '--color-primary'),
					isSource: true,
					isTarget: false,
					enabled: !this.isReadOnly,
					parameters: {
						nodeIndex: this.nodeIndex,
						type: inputName,
						index,
					},
					dragAllowedWhenFull: false,
					dragProxy: ['Rectangle', { width: 1, height: 1, strokeWidth: 0 }],
				};

				if (nodeTypeData.outputNames) {
					// Apply output names if they got set
					newEndpointData.overlays = [
						CanvasHelpers.getOutputNameOverlay(nodeTypeData.outputNames[index]),
					];
				}

				const endpoint: Endpoint = this.instance.addEndpoint(this.nodeId, newEndpointData);
				endpoint.__meta = {
					nodeName: node.name,
					index: i,
				};
			});
		},
		__makeInstanceDraggable(node: INodeUi) {
			// TODO: This caused problems with displaying old information
			//       https://github.com/jsplumb/katavorio/wiki
			//       https://jsplumb.github.io/jsplumb/home.html
			// Make nodes draggable
			this.instance.draggable(this.nodeId, {
				grid: [CanvasHelpers.GRID_SIZE, CanvasHelpers.GRID_SIZE],
				start: (params: { e: MouseEvent }) => {
					if (this.isReadOnly === true) {
						// Do not allow to move nodes in readOnly mode
						return false;
					}
					// @ts-ignore
					this.dragging = true;

					if (params.e && !this.$store.getters.isNodeSelected(this.data.name)) {
						// Only the node which gets dragged directly gets an event, for all others it is
						// undefined. So check if the currently dragged node is selected and if not clear
						// the drag-selection.
						this.instance.clearDragSelection();
						this.$store.commit('resetSelectedNodes');
					}

					this.$store.commit('addActiveAction', 'dragActive');
					return true;
				},
				stop: (params: { e: MouseEvent }) => {
					// @ts-ignore
					this.dragging = false;
					if (this.$store.getters.isActionActive('dragActive')) {
						const moveNodes = this.$store.getters.getSelectedNodes.slice();
						const selectedNodeNames = moveNodes.map((node: INodeUi) => node.name);
						if (!selectedNodeNames.includes(this.data.name)) {
							// If the current node is not in selected add it to the nodes which
							// got moved manually
							moveNodes.push(this.data);
						}

						// This does for some reason just get called once for the node that got clicked
						// even though "start" and "drag" gets called for all. So lets do for now
						// some dirty DOM query to get the new positions till I have more time to
						// create a proper solution
						let newNodePositon: XYPosition;
						moveNodes.forEach((node: INodeUi) => {
							const nodeElement = `node-${this.getNodeIndex(node.name)}`;
							const element = document.getElementById(nodeElement);
							if (element === null) {
								return;
							}

							newNodePositon = [
								parseInt(element.style.left!.slice(0, -2), 10),
								parseInt(element.style.top!.slice(0, -2), 10),
							];

							const updateInformation = {
								name: node.name,
								properties: {
									// @ts-ignore, draggable does not have definitions
									position: newNodePositon,
								},
							};

							this.$store.commit('updateNodeProperties', updateInformation);
						});

						this.$emit('moved', node);
					}
				},
				filter: '.node-description, .node-description .node-name, .node-description .node-subtitle',
			});
		},
		__addNode (node: INodeUi) {
			let nodeTypeData = this.$store.getters.nodeType(node.type) as INodeTypeDescription | null;
			if (!nodeTypeData) {
				// If node type is not know use by default the base.noOp data to display it
				nodeTypeData = this.$store.getters.nodeType(NO_OP_NODE_TYPE) as INodeTypeDescription;
			}

			this.__addInputEndpoints(node, nodeTypeData);
			this.__addOutputEndpoints(node, nodeTypeData);
			this.__makeInstanceDraggable(node);
		},
		touchEnd(e: MouseEvent) {
			if (this.isTouchDevice) {
				if (this.$store.getters.isActionActive('dragActive')) {
					this.$store.commit('removeActiveAction', 'dragActive');
				}
			}
		},
		mouseLeftClick (e: MouseEvent) {
			// @ts-ignore
			const path = e.path || (e.composedPath && e.composedPath());
			for (let index = 0; index < path.length; index++) {
				if (path[index].className && typeof path[index].className === 'string' && path[index].className.includes('no-select-on-click')) {
					return;
				}
			}

			if (!this.isTouchDevice) {
				if (this.$store.getters.isActionActive('dragActive')) {
					this.$store.commit('removeActiveAction', 'dragActive');
				} else {
					if (this.isCtrlKeyPressed(e) === false) {
						this.$emit('deselectAllNodes');
					}

					if (this.$store.getters.isNodeSelected(this.data.name)) {
						this.$emit('deselectNode', this.name);
					} else {
						this.$emit('nodeSelected', this.name);
					}
				}
			}
		},
	},
});
