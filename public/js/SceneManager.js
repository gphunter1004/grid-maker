import * as THREE from 'three';

export class SceneManager {
    constructor(scene) {
        this.scene = scene;
        this.objectGroups = {
            floor: new THREE.Group(),
            agvGrid: new THREE.Group()
        };
        
        // Add object groups to scene
        for (const group of Object.values(this.objectGroups)) {
            this.scene.add(group);
        }
        
        // Set initial positions
        this.objectGroups.floor.position.y = 0; // Floor at bottom
        this.objectGroups.agvGrid.position.y = 0.01; // AGV grid just above floor
    }
    
    // Add object to specific group
    addToGroup(groupName, object) {
        if (this.objectGroups[groupName]) {
            this.objectGroups[groupName].add(object);
        } else {
            console.error(`Group '${groupName}' does not exist.`);
        }
    }
    
    // Clear all objects from a specific group
    clearGroup(groupName) {
        if (this.objectGroups[groupName]) {
            while (this.objectGroups[groupName].children.length > 0) {
                const object = this.objectGroups[groupName].children[0];
                this.objectGroups[groupName].remove(object);
                
                // Properly dispose of resources
                if (object.geometry) object.geometry.dispose();
                if (object.material) {
                    if (Array.isArray(object.material)) {
                        object.material.forEach(material => material.dispose());
                    } else {
                        object.material.dispose();
                    }
                }
            }
        } else {
            console.error(`Group '${groupName}' does not exist.`);
        }
    }
    
    // Get specific group
    getGroup(groupName) {
        return this.objectGroups[groupName];
    }
    
    // Get all intersections with a raycaster
    getIntersections(raycaster) {
        const intersects = [];
        
        // Check intersections for each group
        for (const group of Object.values(this.objectGroups)) {
            const groupIntersects = raycaster.intersectObjects(group.children, true);
            intersects.push(...groupIntersects);
        }
        
        // Sort intersections by distance
        return intersects.sort((a, b) => a.distance - b.distance);
    }
    
    // Get dimensions of a specific group
    getGroupDimensions(groupName) {
        if (!this.objectGroups[groupName]) {
            console.error(`Group '${groupName}' does not exist.`);
            return null;
        }
        
        const group = this.objectGroups[groupName];
        
        // If group is empty, return null
        if (group.children.length === 0) {
            return null;
        }
        
        // Calculate bounding box
        const boundingBox = new THREE.Box3().setFromObject(group);
        const size = new THREE.Vector3();
        boundingBox.getSize(size);
        
        return {
            width: size.x,
            height: size.y,
            depth: size.z,
            boundingBox: boundingBox
        };
    }
}